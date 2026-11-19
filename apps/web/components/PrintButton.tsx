'use client';

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()}
      className="rounded border border-primary-600 px-4 py-1.5 text-sm font-medium text-primary-700 hover:bg-primary-50">
      Print
    </button>
  );
}
