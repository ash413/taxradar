export interface Transaction {
    id: string;
    date: string | null;
    merchant: string | null;
    description: string;
    amount: number;
    currency: string;
    category_hint: string | null;
    source_row: number;
  }
  
  export interface Classification {
    category: string;
    eligibility: string;
    confidence: number;
    deduction_bucket: string;
    reason: string;
    source: string;
  }
  
  export interface ClassifiedTransaction {
    transaction: Transaction;
    classification: Classification;
  }
  
  export interface ParseSummary {
    total_rows: number;
    parsed_rows: number;
    skipped_rows: number;
    total_amount: number;
    date_range_start: string | null;
    date_range_end: string | null;
    warnings: string[];
  }
  
  export interface ClassifyResponse {
    filename: string;
    summary: ParseSummary;
    results: ClassifiedTransaction[];
  }