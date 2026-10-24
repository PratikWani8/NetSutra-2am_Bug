export interface ApiResponse<T = any> {
  success: true;
  data: T;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: any;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetail;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
