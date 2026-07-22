import type { CartItem } from "@/lib/cart/cart";

export type CheckoutCustomerDetails = {
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  district: string;
  city: string;
  postalCode: string;
  country: string;
};

export type CheckoutSessionPayload = {
  cartItems: CartItem[];
  subtotal: number;
  customer: CheckoutCustomerDetails;
};
