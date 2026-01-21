import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Cart from '../pages/Cart'

describe('Cart Component', () => {
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

  const mockOnRemove = vi.fn()
  const mockOnCheckout = vi.fn()
  const mockOnContinueShopping = vi.fn()

  it('should display shopping cart heading', () => {
    render(
      <Cart cart={[]} onRemove={mockOnRemove} onCheckout={mockOnCheckout} onContinueShopping={mockOnContinueShopping} />
    )
    expect(screen.getByText('Shopping Cart')).toBeInTheDocument()
  })

  it('should show empty cart message when cart is empty', () => {
    render(
      <Cart cart={[]} onRemove={mockOnRemove} onCheckout={mockOnCheckout} onContinueShopping={mockOnContinueShopping} />
    )
    expect(screen.getByText('Your cart is empty')).toBeInTheDocument()
  })

  it('should display all cart items', () => {
    render(
      <Cart cart={mockCart} onRemove={mockOnRemove} onCheckout={mockOnCheckout} onContinueShopping={mockOnContinueShopping} />
    )
    expect(screen.getByText('Test Item 1')).toBeInTheDocument()
    expect(screen.getByText('Test Item 2')).toBeInTheDocument()
  })

  it('should display correct quantities', () => {
    render(
      <Cart cart={mockCart} onRemove={mockOnRemove} onCheckout={mockOnCheckout} onContinueShopping={mockOnContinueShopping} />
    )
    expect(screen.getByText('Qty: 2')).toBeInTheDocument()
    expect(screen.getByText('Qty: 1')).toBeInTheDocument()
  })

  it('should calculate and display correct total', () => {
    render(
      <Cart cart={mockCart} onRemove={mockOnRemove} onCheckout={mockOnCheckout} onContinueShopping={mockOnContinueShopping} />
    )
    // (1000 * 2) + (1500 * 1) = 3500 cents = $35.00
    expect(screen.getByText('$35.00')).toBeInTheDocument()
  })

  it('should have remove buttons for each item', () => {
    render(
      <Cart cart={mockCart} onRemove={mockOnRemove} onCheckout={mockOnCheckout} onContinueShopping={mockOnContinueShopping} />
    )
    const removeButtons = screen.getAllByText('Remove')
    expect(removeButtons).toHaveLength(2)
  })

  it('should have Proceed to Checkout button', () => {
    render(
      <Cart cart={mockCart} onRemove={mockOnRemove} onCheckout={mockOnCheckout} onContinueShopping={mockOnContinueShopping} />
    )
    expect(screen.getByText('Proceed to Checkout')).toBeInTheDocument()
  })

  it('should have Continue Shopping button', () => {
    render(
      <Cart cart={mockCart} onRemove={mockOnRemove} onCheckout={mockOnCheckout} onContinueShopping={mockOnContinueShopping} />
    )
    expect(screen.getByText('Continue Shopping')).toBeInTheDocument()
  })
})
