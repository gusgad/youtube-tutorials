import React, { useEffect, useState } from 'react'
import Shop from './pages/Shop'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'

export default function App() {
  const [page, setPage] = useState('shop')
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])

  useEffect(() => {
    fetch('http://localhost:4000/api/products')
      .then((r) => r.json())
      .then(setProducts)
  }, [])

  function addToCart(p) {
    setCart((c) => {
      const found = c.find((x) => x.id === p.id)
      if (found) return c.map((x) => (x.id === p.id ? { ...x, qty: x.qty + 1 } : x))
      return [...c, { ...p, qty: 1 }]
    })
  }

  function removeFromCart(id) {
    setCart((c) => c.filter((x) => x.id !== id))
  }

  function goToCart() {
    setPage('cart')
  }

  function goToCheckout() {
    setPage('checkout')
  }

  function goToShop() {
    setPage('shop')
  }

  return (
    <div className="app">
      <header className="header">
        <h1 onClick={() => goToShop()} style={{ cursor: 'pointer' }}>Minimal Shop</h1>
        <div className="cart-summary" onClick={goToCart} style={{ cursor: 'pointer' }}>
          Cart: {cart.length} items
        </div>
      </header>

      {page === 'shop' && (
        <Shop products={products} cart={cart} onAddToCart={addToCart} onViewCart={goToCart} />
      )}
      {page === 'cart' && (
        <Cart cart={cart} onRemove={removeFromCart} onCheckout={goToCheckout} onContinueShopping={goToShop} />
      )}
      {page === 'checkout' && (
        <Checkout cart={cart} onBackToCart={() => setPage('cart')} onBackToShop={() => { setCart([]); goToShop() }} />
      )}
    </div>
  )
}
