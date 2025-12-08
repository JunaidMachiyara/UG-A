import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Download, Upload as UploadIcon } from 'lucide-react';

interface ProductionRecord {
  productionDate: string;
  itemId: string;
  quantity: number;
}

interface ProductionCSVUploadProps {
  onSubmitRecords?: (records: ProductionRecord[]) => void;
}

const ProductionCSVUpload: React.FC<ProductionCSVUploadProps> = ({ onSubmitRecords }) => {
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleSubmit = () => {
    if (onSubmitRecords) {
      onSubmitRecords(records);
      setRecords([]); // Clear after submit
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed: ProductionRecord[] = [];
        for (const row of results.data as any[]) {
          if (!row['Production Date'] || !row['Item ID'] || !row['Quantity']) {
            setError('Missing required fields in CSV.');
            return;
          }
          parsed.push({
            productionDate: row['Production Date'],
            itemId: row['Item ID'],
            quantity: Number(row['Quantity']),
          });
        }
        setRecords(parsed);
        setError(null);
      },
      error: (err) => setError(err.message),
    });
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg shadow"
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadIcon size={18} /> Upload CSV
        </button>
        <input
          type="file"
          accept=".csv"
          ref={fileInputRef}
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        <a
          href="/production_template.csv"
          download
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg shadow"
          style={{ textDecoration: 'none' }}
        >
          <Download size={18} /> Download Template
        </a>
        {error && <div style={{ color: 'red', marginLeft: '1rem' }}>{error}</div>}
      </div>
      {records.length > 0 && (
        <div className="mt-2">
          <table className="border border-slate-200 rounded w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-2 py-1">Production Date</th>
                <th className="px-2 py-1">Item ID</th>
                <th className="px-2 py-1">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {records.map((rec, idx) => (
                <tr key={idx}>
                  <td className="px-2 py-1">{rec.productionDate}</td>
                  <td className="px-2 py-1">{rec.itemId}</td>
                  <td className="px-2 py-1">{rec.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
            onClick={handleSubmit}
            disabled={records.length === 0}
          >
            Submit Production Data
          </button>
        </div>
      )}
    </div>
  );
}

export default ProductionCSVUpload;
