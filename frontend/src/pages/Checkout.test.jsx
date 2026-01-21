import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Checkout from '../pages/Checkout'

describe('Checkout Component', () => {
  const mockCart = [
    {
      id: 'p1',
      name: 'Test Item 1',
      description: 'A test item',
      price: 1000,
      qty: 2,
      image: 'https://example.com/image1.jpg'
    },
    {
      id: 'p2',
      name: 'Test Item 2',
      description: 'Another test item',
      price: 1500,
      qty: 1,
      image: 'https://example.com/image2.jpg'
    }
  ]

  const mockOnBackToCart = vi.fn()
  const mockOnBackToShop = vi.fn()

  it('should display checkout heading', () => {
    render(
      <Checkout cart={mockCart} onBackToCart={mockOnBackToCart} onBackToShop={mockOnBackToShop} />
    )
    expect(screen.getByText('Checkout')).toBeInTheDocument()
  })

  it('should display billing information section', () => {
    render(
      <Checkout cart={mockCart} onBackToCart={mockOnBackToCart} onBackToShop={mockOnBackToShop} />
    )
    expect(screen.getByText('Billing Information')).toBeInTheDocument()
  })

  it('should display payment details section', () => {
    render(
      <Checkout cart={mockCart} onBackToCart={mockOnBackToCart} onBackToShop={mockOnBackToShop} />
    )
    expect(screen.getByText('Payment Details')).toBeInTheDocument()
  })

  it('should display form inputs for billing info', () => {
    render(
      <Checkout cart={mockCart} onBackToCart={mockOnBackToCart} onBackToShop={mockOnBackToShop} />
    )
    expect(screen.getByPlaceholderText('Full Name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Shipping Address')).toBeInTheDocument()
  })

  it('should display form inputs for payment details', () => {
    render(
      <Checkout cart={mockCart} onBackToCart={mockOnBackToCart} onBackToShop={mockOnBackToShop} />
    )
    expect(screen.getByPlaceholderText('Card Number (16 digits)')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('MM/YY')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('CVC')).toBeInTheDocument()
  })

  it('should display order summary', () => {
    render(
      <Checkout cart={mockCart} onBackToCart={mockOnBackToCart} onBackToShop={mockOnBackToShop} />
    )
    expect(screen.getByText('Order Summary')).toBeInTheDocument()
  })

  it('should display cart items in order summary', () => {
    render(
      <Checkout cart={mockCart} onBackToCart={mockOnBackToCart} onBackToShop={mockOnBackToShop} />
    )
    expect(screen.getByText('Test Item 1')).toBeInTheDocument()
    expect(screen.getByText('Test Item 2')).toBeInTheDocument()
  })

  it('should calculate and display correct total in summary', () => {
    render(
      <Checkout cart={mockCart} onBackToCart={mockOnBackToCart} onBackToShop={mockOnBackToShop} />
    )
    // (1000 * 2) + (1500 * 1) = 3500 cents = $35.00
    expect(screen.getByText('$35.00')).toBeInTheDocument()
  })

  it('should have pay button with total', () => {
    render(
      <Checkout cart={mockCart} onBackToCart={mockOnBackToCart} onBackToShop={mockOnBackToShop} />
    )
    expect(screen.getByText('Pay $35.00')).toBeInTheDocument()
  })

  it('should have Back to Cart button', () => {
    render(
      <Checkout cart={mockCart} onBackToCart={mockOnBackToCart} onBackToShop={mockOnBackToShop} />
    )
    expect(screen.getByText('Back to Cart')).toBeInTheDocument()
  })
})
