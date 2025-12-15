import { Document } from 'mongoose';

export interface BaseEntity extends Document {
  readonly createdAt?: Date; // Timestamp of creation
  readonly updatedAt?: Date; // Timestamp of last update
}

export interface PaginatedResponse<T> {
  result: T[]; // Array of items for the current page
  totalCount: number; // Total number of items across all pages
  currentPage: number; // Current page number
  totalPages: number; // Total number of pages
  previousPage: number | null; // Previous page number or null if on the first page
  nextPage: number | null; // Next page number or null if on the last page
}
