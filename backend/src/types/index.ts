export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ApiError {
  error: string;
  message?: string;
}

export interface ApiSuccess<T = undefined> {
  success: true;
  data?: T;
}
