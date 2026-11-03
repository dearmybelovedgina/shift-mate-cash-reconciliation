
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { createWorker } from "tesseract.js";

export const Route = createFileRoute("/ocr-pos")({
  component: OCRPosPage,
});

type POSFields = {
  cashSales: string;
  cashOutflows: string;
  qrSales: string;
};

type ExtractedLine = {
  label: string;
  original: string;
  amount: string;
};

const EMPTY_FIELDS: POSFields = {
  cashSales: "",
  cashOutflows: "",
  qrSales: "",
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function extractAmount(line: string): string | null {
  // Read the final numeric value on a receipt line.
  // Examples: 1,990,000 / -200,000 / 0
  const match = line.match(
    /(-?\d{1,3}(?:[.,]\d{3})+|-?\d+)\s*(?:đ|d|vnd)?\s*$/i
  );

  if (!match) return null;

  const digits = match[1].replace(/[.,]/g, "");
  const value = Number(digits);

  if (!Number.isFinite(value)) return null;

  return String(value);
}

function getReceiptLines(text: string): ExtractedLine[] {
  const patterns = [
    { label: "Bán hàng", regex: /\bban hang\b/ },
    { label: "Phiếu thu", regex: /\bphieu thu\b/ },
    { label: "Phiếu chi", regex: /\bphieu chi\b/ },
    { label: "Tiền mặt trong ca", regex: /\btien mat trong ca\b/ },
    { label: "Tiền mặt đầu ca", regex: /\btien mat dau ca\b/ },
    { label: "Tiền mặt cuối ca", regex: /\btien mat cuoi ca\b/ },
    { label: "Chuyển khoản", regex: /\bchuyen khoan\b/ },
    { label: "Thẻ", regex: /\bthe\b/ },
    { label: "Doanh thu tiền mặt", regex: /\bdoanh thu tien mat\b/ },
    { label: "Chi tiền mặt POS", regex: /\bchi tien mat\b/ },
  ];

  return text
    .split(/\r?\n/)
    .map((original) => {
      const normalized = normalizeText(original);
      const matched = patterns.find((p) => p.regex.test(normalized));
      const amount = extractAmount(original);

      if (!matched || amount === null) return null;

      return {
        label: matched.label,
        original: original.trim(),
        amount,
      };
    })
    .filter((item): item is ExtractedLine => item !== null);
}

function parsePOS(text: string): POSFields {
  const result: POSFields = { ...EMPTY_FIELDS };
  const lines = getReceiptLines(text);

  for (const item of lines) {
    switch (item.label) {
      case "Doanh thu tiền mặt":
        // Only map an explicitly named cash-sales field.
        result.cashSales = item.amount;
        break;

      case "Phiếu chi":
      case "Chi tiền mặt POS":
        // Outflows are entered as a positive amount in Shift-Mate.
        result.cashOutflows = String(Math.abs(Number(item.amount)));
        break;

      case "Chuyển khoản":
        result.qrSales = String(Math.abs(Number(item.amount)));
        break;
    }
  }

  // "Bán hàng" may include different payment methods.
  // "Tiền mặt trong ca" may be net of expenses/receipts.
  // Neither is automatically mapped to cashSales.
  return result;
}

function formatMoney(value: string) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString("vi-VN") + " đ"
    : "Không hợp lệ";
}

function OCRPosPage() {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [rawText, setRawText] = useState("");
  const [fields, setFields] = useState<POSFields>({ ...EMPTY_FIELDS });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [seconds, setSeconds] = useState<number | null>(null);

  const receiptLines = getReceiptLines(rawText);

  function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;

    if (!selected.type.startsWith("image/")) {
      setError("Vui lòng chọn file ảnh hợp lệ.");
      return;
    }

    if (selected.size > 10 * 1024 * 1024) {
      setError("Ảnh quá lớn. Vui lòng chọn ảnh dưới 10 MB.");
      return;
    }

    if (imageUrl) URL.revokeObjectURL(imageUrl);

    setFile(selected);
    setImageUrl(URL.createObjectURL(selected));
    setRawText("");
    setFields({ ...EMPTY_FIELDS });
    setConfirmed(false);
    setSeconds(null);
    setError("");
  }

  async function scanImage() {
    if (!file || loading) return;

    setLoading(true);
    setError("");
    setConfirmed(false);
    setRawText("");
    setFields({ ...EMPTY_FIELDS });

    const start = performance.now();
    let worker: Awaited<ReturnType<typeof createWorker>> | null = null;

    try {
      worker = await createWorker(["vie", "eng"]);
      const { data } = await worker.recognize(file);

      if (!data.text.trim()) {
        setError(
          "Không đọc được văn bản trong ảnh. Hãy thử ảnh rõ hơn."
        );
        return;
      }

      setRawText(data.text);
      setFields(parsePOS(data.text));
    } catch (err) {
      console.error(err);
      setError(
        "Không thể xử lý OCR. Hãy kiểm tra kết nối mạng và thử lại."
      );
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch (err) {
          console.error("Worker cleanup error:", err);
        }
      }

      setSeconds(
        Math.round((performance.now() - start) / 100) / 10
      );
      setLoading(false);
    }
  }

  function updateField(key: keyof POSFields, value: string) {
    setFields((previous) => ({
      ...previous,
      [key]: value.replace(/\D/g, ""),
    }));
    setConfirmed(false);
  }

  const valid =
    rawText.trim() !== "" &&
    fields.cashSales !== "" &&
    fields.cashOutflows !== "" &&
    fields.qrSales !== "" &&
    !loading;

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <p className="text-sm font-semibold text-blue-600">
          PART C — AUTOMATION
        </p>
        <h1 className="text-3xl font-bold">
          POS Summary OCR Extractor
        </h1>
        <p className="mt-2 text-gray-600">
          Đọc phiếu kết ca POS bằng OCR, kiểm tra dữ liệu và
          xác nhận trước khi sử dụng cho đối soát.
        </p>
      </header>

      <section className="space-y-4 rounded-xl border bg-white p-5">
        <h2 className="font-semibold">
          1. Tải ảnh phiếu kết ca POS
        </h2>

        <input
          type="file"
          accept="image/*"
          onChange={chooseFile}
          className="block w-full text-sm"
        />

        {imageUrl && (
          <img
            src={imageUrl}
            alt="Ảnh phiếu kết ca POS"
            className="max-h-80 rounded-lg border object-contain"
          />
        )}

        <button
          type="button"
          onClick={scanImage}
          disabled={!file || loading}
          className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white disabled:opacity-50"
        >
          {loading ? "Đang nhận diện ảnh..." : "Đọc ảnh bằng OCR"}
        </button>

        {seconds !== null && (
          <p className="text-sm text-gray-600">
            Thời gian xử lý: {seconds} giây
          </p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>

      <section className="space-y-4 rounded-xl border bg-white p-5">
        <h2 className="font-semibold">
          2. Các khoản nhận diện từ phiếu POS
        </h2>

        <p className="text-sm text-amber-700">
          Đây là dữ liệu OCR chưa xác minh. Tên trường được
          giữ theo nội dung chứng từ, không tự suy đoán công thức POS.
        </p>

        {rawText && receiptLines.length === 0 && (
          <p className="text-sm text-gray-500">
            OCR đã đọc được văn bản nhưng chưa nhận diện được
            trường tài chính phù hợp.
          </p>
        )}

        {!rawText && (
          <p className="text-sm text-gray-500">
            Chưa có dữ liệu OCR.
          </p>
        )}

        {receiptLines.map((item, index) => (
          <div
            key={index}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3"
          >
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-gray-500">
                OCR: {item.original}
              </p>
            </div>
            <p className="font-semibold">
              {formatMoney(item.amount)}
            </p>
          </div>
        ))}
      </section>

      <section className="space-y-4 rounded-xl border bg-white p-5">
        <h2 className="font-semibold">
          3. Kiểm tra số liệu dùng cho Shift-Mate
        </h2>

        <p className="text-sm text-amber-700">
          Doanh thu tiền mặt phải được xác định từ chứng từ
          hoặc dữ liệu POS đáng tin cậy. Không tự sử dụng
          "Bán hàng" hoặc "Tiền mặt trong ca" thay thế.
        </p>

        {([
          ["cashSales", "Doanh thu tiền mặt POS"],
          ["cashOutflows", "Chi tiền mặt đã ghi POS"],
          ["qrSales", "Doanh thu QR / chuyển khoản"],
        ] as const).map(([key, label]) => (
          <label key={key} className="block space-y-1">
            <span className="text-sm font-medium">{label}</span>
            <input
              type="text"
              inputMode="numeric"
              value={fields[key]}
              onChange={(event) =>
                updateField(key, event.target.value)
              }
              placeholder="Cần kiểm tra / nhập thủ công"
              className="w-full rounded-lg border px-3 py-2"
            />
          </label>
        ))}

        <button
          type="button"
          disabled={!valid}
          onClick={() => setConfirmed(true)}
          className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white disabled:opacity-50"
        >
          Tôi đã đối chiếu và xác nhận
        </button>

        {confirmed && (
          <div className="space-y-2 rounded-lg border border-green-300 bg-green-50 p-4 text-sm">
            <p className="font-semibold text-green-800">
              Đã ghi nhận xác nhận của người dùng
            </p>
            <p>Doanh thu tiền mặt: {formatMoney(fields.cashSales)}</p>
            <p>Chi tiền mặt POS: {formatMoney(fields.cashOutflows)}</p>
            <p>Doanh thu QR: {formatMoney(fields.qrSales)}</p>
            <p className="text-gray-600">
              Số liệu do người dùng chịu trách nhiệm đối chiếu.
              Chưa tự động cập nhật vào ca hiện tại.
            </p>
          </div>
        )}
      </section>

      <details className="rounded-xl border bg-white p-5">
        <summary className="cursor-pointer font-semibold">
          4. Xem văn bản OCR thô (để kiểm thử)
        </summary>
        <pre className="mt-3 whitespace-pre-wrap break-words text-xs">
          {rawText || "Chưa có kết quả OCR."}
        </pre>
      </details>
    </main>
  );
}
