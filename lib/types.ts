export interface Product {
  id: number;
  title: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  thumbnail: string;
  images: string[];
  brand?: string;
}

export interface ProductListResponse {
  products: Product[];
  total: number;
  skip: number;
  limit: number;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  image: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  image: string;
}

export type SortField = 'title' | 'price' | 'stock';
export type SortOrder = 'asc' | 'desc';

export interface StockQueryParams {
  q: string;
  category: string;
  sortBy: SortField;
  order: SortOrder;
  page: number;
}
