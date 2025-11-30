import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Upload, FileText } from 'lucide-react';
import Papa from 'papaparse';

interface ValidationIssue {
    severity: 'error' | 'warning' | 'info';
    row: number;
    field: string;
    message: string;
}

interface ValidationResult {
    valid: boolean;
    issues: ValidationIssue[];
    summary: {
        totalRows: number;
        validRows: number;
        errors: number;
        warnings: number;
    };
}

export const CSVValidator: React.FC = () => {
    const [entityType, setEntityType] = useState<'items' | 'partners' | 'accounts' | 'categories' | 'sections'>('items');
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
    const [fileName, setFileName] = useState<string>('');

    const validateItemsCSV = (data: any[]): ValidationResult => {
        const issues: ValidationIssue[] = [];
        let validRows = 0;

        data.forEach((row, index) => {
            const rowNum = index + 2; // +2 because index starts at 0 and row 1 is header
            let rowValid = true;

            // Required fields validation
            if (!row.id || row.id.trim() === '') {
                issues.push({
                    severity: 'error',
                    row: rowNum,
                    field: 'id',
                    message: 'Missing required field: id'
                });
                rowValid = false;
            }

            if (!row.name || row.name.trim() === '') {
                issues.push({
                    severity: 'error',
                    row: rowNum,
                    field: 'name',
                    message: 'Missing required field: name'
                });
                rowValid = false;
            }

            // Critical fields for reports
            if (!row.category || row.category.trim() === '') {
                issues.push({
                    severity: 'error',
                    row: rowNum,
                    field: 'category',
                    message: 'Missing required field: category (needed for reports)'
                });
                rowValid = false;
            }

            if (!row.section || row.section.trim() === '') {
                issues.push({
                    severity: 'error',
                    row: rowNum,
                    field: 'section',
                    message: 'Missing required field: section (needed for reports)'
                });
                rowValid = false;
            }

            if (!row.packingType || row.packingType.trim() === '') {
                issues.push({
                    severity: 'error',
                    row: rowNum,
                    field: 'packingType',
                    message: 'Missing required field: packingType (needed for reports)'
                });
                rowValid = false;
            }

            // Numeric field validation
            if (!row.weightPerUnit || isNaN(parseFloat(row.weightPerUnit)) || parseFloat(row.weightPerUnit) <= 0) {
                issues.push({
                    severity: 'error',
                    row: rowNum,
                    field: 'weightPerUnit',
                    message: 'weightPerUnit must be a number greater than 0 (needed for calculations)'
                });
                rowValid = false;
            }

            if (!row.avgCost || isNaN(parseFloat(row.avgCost)) || parseFloat(row.avgCost) <= 0) {
                issues.push({
                    severity: 'error',
                    row: rowNum,
                    field: 'avgCost',
                    message: 'avgCost must be a number greater than 0 (needed for cost reports)'
                });
                rowValid = false;
            }

            // Optional numeric fields - warnings only
            if (row.salePrice && (isNaN(parseFloat(row.salePrice)) || parseFloat(row.salePrice) < 0)) {
                issues.push({
                    severity: 'warning',
                    row: rowNum,
                    field: 'salePrice',
                    message: 'salePrice should be a positive number or empty'
                });
            }

            if (row.stockQty && isNaN(parseFloat(row.stockQty))) {
                issues.push({
                    severity: 'warning',
                    row: rowNum,
                    field: 'stockQty',
                    message: 'stockQty should be a number or empty'
                });
            }

            if (row.openingStock && isNaN(parseFloat(row.openingStock))) {
                issues.push({
                    severity: 'warning',
                    row: rowNum,
                    field: 'openingStock',
                    message: 'openingStock should be a number or empty'
                });
            }

            // ID format check
            if (row.id && !row.id.match(/^[a-zA-Z0-9-_]+$/)) {
                issues.push({
                    severity: 'warning',
                    row: rowNum,
                    field: 'id',
                    message: 'ID contains special characters - recommended format: item-001, item-002, etc.'
                });
            }

            if (rowValid) validRows++;
        });

        const errors = issues.filter(i => i.severity === 'error').length;
        const warnings = issues.filter(i => i.severity === 'warning').length;

        return {
            valid: errors === 0,
            issues,
            summary: {
                totalRows: data.length,
                validRows,
                errors,
                warnings
            }
        };
    };

    const validatePartnersCSV = (data: any[]): ValidationResult => {
        const issues: ValidationIssue[] = [];
        let validRows = 0;

        data.forEach((row, index) => {
            const rowNum = index + 2;
            let rowValid = true;

            if (!row.id || row.id.trim() === '') {
                issues.push({ severity: 'error', row: rowNum, field: 'id', message: 'Missing required field: id' });
                rowValid = false;
            }

            if (!row.name || row.name.trim() === '') {
                issues.push({ severity: 'error', row: rowNum, field: 'name', message: 'Missing required field: name' });
                rowValid = false;
            }

            if (!row.type || !['CUSTOMER', 'SUPPLIER'].includes(row.type)) {
                issues.push({ severity: 'error', row: rowNum, field: 'type', message: 'type must be either "CUSTOMER" or "SUPPLIER"' });
                rowValid = false;
            }

            if (row.balance && isNaN(parseFloat(row.balance))) {
                issues.push({ severity: 'warning', row: rowNum, field: 'balance', message: 'balance should be a number' });
            }

            if (rowValid) validRows++;
        });

        const errors = issues.filter(i => i.severity === 'error').length;
        const warnings = issues.filter(i => i.severity === 'warning').length;

        return {
            valid: errors === 0,
            issues,
            summary: { totalRows: data.length, validRows, errors, warnings }
        };
    };

    const validateAccountsCSV = (data: any[]): ValidationResult => {
        const issues: ValidationIssue[] = [];
        let validRows = 0;

        data.forEach((row, index) => {
            const rowNum = index + 2;
            let rowValid = true;

            if (!row.id || row.id.trim() === '') {
                issues.push({ severity: 'error', row: rowNum, field: 'id', message: 'Missing required field: id' });
                rowValid = false;
            }

            if (!row.name || row.name.trim() === '') {
                issues.push({ severity: 'error', row: rowNum, field: 'name', message: 'Missing required field: name' });
                rowValid = false;
            }

            if (!row.type || !['ASSET', 'LIABILITY', 'EXPENSE', 'REVENUE', 'EQUITY'].includes(row.type)) {
                issues.push({ severity: 'error', row: rowNum, field: 'type', message: 'type must be ASSET, LIABILITY, EXPENSE, REVENUE, or EQUITY' });
                rowValid = false;
            }

            if (row.balance && isNaN(parseFloat(row.balance))) {
                issues.push({ severity: 'warning', row: rowNum, field: 'balance', message: 'balance should be a number' });
            }

            if (rowValid) validRows++;
        });

        const errors = issues.filter(i => i.severity === 'error').length;
        const warnings = issues.filter(i => i.severity === 'warning').length;

        return {
            valid: errors === 0,
            issues,
            summary: { totalRows: data.length, validRows, errors, warnings }
        };
    };

    const validateGenericCSV = (data: any[]): ValidationResult => {
        const issues: ValidationIssue[] = [];
        let validRows = 0;

        data.forEach((row, index) => {
            const rowNum = index + 2;
            let rowValid = true;

            if (!row.id || row.id.trim() === '') {
                issues.push({ severity: 'error', row: rowNum, field: 'id', message: 'Missing required field: id' });
                rowValid = false;
            }

            if (!row.name || row.name.trim() === '') {
                issues.push({ severity: 'error', row: rowNum, field: 'name', message: 'Missing required field: name' });
                rowValid = false;
            }

            if (rowValid) validRows++;
        });

        const errors = issues.filter(i => i.severity === 'error').length;
        const warnings = issues.filter(i => i.severity === 'warning').length;

        return {
            valid: errors === 0,
            issues,
            summary: { totalRows: data.length, validRows, errors, warnings }
        };
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setFileName(file.name);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                let validationResult: ValidationResult;

                switch (entityType) {
                    case 'items':
                        validationResult = validateItemsCSV(results.data);
                        break;
                    case 'partners':
                        validationResult = validatePartnersCSV(results.data);
                        break;
                    case 'accounts':
                        validationResult = validateAccountsCSV(results.data);
                        break;
                    default:
                        validationResult = validateGenericCSV(results.data);
                }

                setValidationResult(validationResult);
            },
            error: (error) => {
                alert(`Error parsing CSV: ${error.message}`);
            }
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-xl shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                    <FileText size={32} />
                    <h2 className="text-2xl font-bold">CSV Validator</h2>
                </div>
                <p className="text-indigo-100">Validate your CSV files before importing to catch errors early</p>
            </div>

            {/* Entity Type Selector */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-4">Select Entity Type</h3>
                <div className="flex gap-3">
                    {['items', 'partners', 'accounts', 'categories', 'sections'].map((type) => (
                        <button
                            key={type}
                            onClick={() => {
                                setEntityType(type as any);
                                setValidationResult(null);
                                setFileName('');
                            }}
                            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                                entityType === type
                                    ? 'bg-indigo-600 text-white shadow-lg'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                        >
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Upload */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Upload className="text-indigo-600" size={24} />
                    <h3 className="font-bold text-slate-800">Upload CSV File to Validate</h3>
                </div>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-indigo-400 transition-colors">
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="csv-validate-upload"
                    />
                    <label htmlFor="csv-validate-upload" className="cursor-pointer flex flex-col items-center gap-3">
                        <Upload className="text-indigo-600" size={48} />
                        <div>
                            <p className="text-lg font-semibold text-slate-800">
                                Click to upload {entityType} CSV for validation
                            </p>
                            <p className="text-sm text-slate-500 mt-1">
                                File will be checked but NOT imported
                            </p>
                        </div>
                        <div className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700">
                            Browse Files
                        </div>
                    </label>
                </div>
            </div>

            {/* Validation Results */}
            {validationResult && (
                <div className="space-y-4">
                    {/* Summary Card */}
                    <div className={`rounded-lg border-2 p-6 ${
                        validationResult.valid 
                            ? 'bg-emerald-50 border-emerald-300' 
                            : 'bg-red-50 border-red-300'
                    }`}>
                        <div className="flex items-center gap-3 mb-4">
                            {validationResult.valid ? (
                                <CheckCircle className="text-emerald-600" size={32} />
                            ) : (
                                <XCircle className="text-red-600" size={32} />
                            )}
                            <div>
                                <h3 className={`text-xl font-bold ${
                                    validationResult.valid ? 'text-emerald-900' : 'text-red-900'
                                }`}>
                                    {validationResult.valid ? '✅ File is Valid!' : '❌ File Has Errors'}
                                </h3>
                                <p className="text-sm text-slate-600 mt-1">File: {fileName}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white rounded-lg p-4 border border-slate-200">
                                <div className="text-xs text-slate-500 uppercase font-semibold">Total Rows</div>
                                <div className="text-2xl font-bold text-slate-800">{validationResult.summary.totalRows}</div>
                            </div>
                            <div className="bg-white rounded-lg p-4 border border-emerald-200">
                                <div className="text-xs text-emerald-600 uppercase font-semibold">Valid Rows</div>
                                <div className="text-2xl font-bold text-emerald-600">{validationResult.summary.validRows}</div>
                            </div>
                            <div className="bg-white rounded-lg p-4 border border-red-200">
                                <div className="text-xs text-red-600 uppercase font-semibold">Errors</div>
                                <div className="text-2xl font-bold text-red-600">{validationResult.summary.errors}</div>
                            </div>
                            <div className="bg-white rounded-lg p-4 border border-amber-200">
                                <div className="text-xs text-amber-600 uppercase font-semibold">Warnings</div>
                                <div className="text-2xl font-bold text-amber-600">{validationResult.summary.warnings}</div>
                            </div>
                        </div>

                        {validationResult.valid && (
                            <div className="mt-4 p-4 bg-emerald-100 border border-emerald-200 rounded-lg">
                                <p className="text-emerald-800 font-semibold">
                                    ✓ This file is ready to import! You can now upload it in the Import/Export module.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Issues List */}
                    {validationResult.issues.length > 0 && (
                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                            <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                                <h3 className="font-bold text-slate-800">
                                    Issues Found ({validationResult.issues.length})
                                </h3>
                            </div>
                            <div className="max-h-96 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-100 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Row</th>
                                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Severity</th>
                                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Field</th>
                                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Message</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {validationResult.issues.map((issue, index) => (
                                            <tr key={index} className="hover:bg-slate-50">
                                                <td className="px-4 py-2 font-mono text-slate-700">{issue.row}</td>
                                                <td className="px-4 py-2">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                                                        issue.severity === 'error' 
                                                            ? 'bg-red-100 text-red-700 border border-red-200'
                                                            : 'bg-amber-100 text-amber-700 border border-amber-200'
                                                    }`}>
                                                        {issue.severity === 'error' ? <XCircle size={12} /> : <AlertTriangle size={12} />}
                                                        {issue.severity}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 font-mono font-semibold text-indigo-600">{issue.field}</td>
                                                <td className="px-4 py-2 text-slate-700">{issue.message}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Validation Rules */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                    <FileText size={20} />
                    Validation Rules for {entityType.charAt(0).toUpperCase() + entityType.slice(1)}
                </h3>
                {entityType === 'items' && (
                    <div className="space-y-2 text-sm text-blue-800">
                        <div><strong className="text-red-700">✓ REQUIRED:</strong> id, name, category, section, packingType, weightPerUnit (must be &gt; 0), avgCost (must be &gt; 0)</div>
                        <div><strong className="text-amber-700">⚠ OPTIONAL:</strong> salePrice, stockQty, openingStock (will default to 0 if empty)</div>
                        <div><strong className="text-blue-700">ℹ INFO:</strong> category, section, weightPerUnit, and avgCost are critical for reports to work correctly</div>
                    </div>
                )}
                {entityType === 'partners' && (
                    <div className="space-y-2 text-sm text-blue-800">
                        <div><strong className="text-red-700">✓ REQUIRED:</strong> id, name, type (must be "CUSTOMER" or "SUPPLIER")</div>
                        <div><strong className="text-amber-700">⚠ OPTIONAL:</strong> country, defaultCurrency, balance, divisionId, subDivisionId</div>
                    </div>
                )}
                {entityType === 'accounts' && (
                    <div className="space-y-2 text-sm text-blue-800">
                        <div><strong className="text-red-700">✓ REQUIRED:</strong> id, name, type (must be "ASSET", "LIABILITY", "EXPENSE", "REVENUE", or "EQUITY")</div>
                        <div><strong className="text-amber-700">⚠ OPTIONAL:</strong> balance, description</div>
                    </div>
                )}
                {(entityType === 'categories' || entityType === 'sections') && (
                    <div className="space-y-2 text-sm text-blue-800">
                        <div><strong className="text-red-700">✓ REQUIRED:</strong> id, name</div>
                        <div><strong className="text-amber-700">⚠ OPTIONAL:</strong> description</div>
                    </div>
                )}
            </div>
        </div>
    );
};
