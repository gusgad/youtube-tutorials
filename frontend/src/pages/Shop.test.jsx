import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Shop from '../pages/Shop'

describe('Shop Component', () => {
  const mockProducts = [
    {
      id: 'p1',
      name: 'Test Item 1',
      description: 'A test item',
      price: 1000,
      image: 'https://example.com/image1.jpg'
    },
    {
      id: 'p2',
      name: 'Test Item 2',
      description: 'Another test item',
      price: 2000,
      image: 'https://example.com/image2.jpg'
    }
  ]

  const mockOnAddToCart = vi.fn()
  const mockOnViewCart = vi.fn()

  it('should render hero section', () => {
    render(
      <Shop products={[]} onAddToCart={mockOnAddToCart} onViewCart={mockOnViewCart} />
    )
    expect(screen.getByText('Beautiful goods, thoughtfully made')).toBeInTheDocument()
  })

  it('should display all products', () => {
    render(
      <Shop products={mockProducts} onAddToCart={mockOnAddToCart} onViewCart={mockOnViewCart} />
    )
    expect(screen.getByText('Test Item 1')).toBeInTheDocument()
    expect(screen.getByText('Test Item 2')).toBeInTheDocument()
  })

  it('should display product descriptions', () => {
    render(
      <Shop products={mockProducts} onAddToCart={mockOnAddToCart} onViewCart={mockOnViewCart} />
    )
    expect(screen.getByText('A test item')).toBeInTheDocument()
    expect(screen.getByText('Another test item')).toBeInTheDocument()
  })

  it('should display product prices in correct format', () => {
    render(
      <Shop products={mockProducts} onAddToCart={mockOnAddToCart} onViewCart={mockOnViewCart} />
    )
    expect(screen.getByText('$10.00')).toBeInTheDocument()
    expect(screen.getByText('$20.00')).toBeInTheDocument()
  })

  it('should have Add to cart buttons for each product', () => {
    render(
      <Shop products={mockProducts} onAddToCart={mockOnAddToCart} onViewCart={mockOnViewCart} />
    )
    const buttons = screen.getAllByText('Add to cart')
    expect(buttons).toHaveLength(2)
  })
})
