import React, { useState } from 'react'

function currency(cents) {
  return `$${(cents / 100).toFixed(2)}`
}

export default function Checkout({ cart, onBackToCart, onBackToShop }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    address: '',
    cardNumber: '',
    expiry: '',
    cvc: ''
  })

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0)

  function handleChange(e) {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  async function handlePayment(e) {
    e.preventDefault()
    if (!formData.name || !formData.email || !formData.address || !formData.cardNumber) {
      setMessage('Please fill in all fields')
      return
    }

    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('http://localhost:4000/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart, payment: formData })
      })
      const data = await res.json()
      if (data.success) {
        setMessage('Payment successful! ✨')
        setTimeout(() => onBackToShop(), 2000)
      } else {
        setMessage(data.message || 'Payment failed')
      }
    } catch (e) {
      setMessage('Network error')
    }
    setLoading(false)
  }

  return (
    <main className="checkout-page">
      <div className="checkout-container">
        <h1>Checkout</h1>

        <div className="checkout-layout">
          <form className="checkout-form" onSubmit={handlePayment}>
            <h2>Billing Information</h2>
            <input
              type="text"
              name="name"
              placeholder="Full Name"
              value={formData.name}
              onChange={handleChange}
            />
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
            />
            <textarea
              name="address"
              placeholder="Shipping Address"
              value={formData.address}
              onChange={handleChange}
              rows="3"
            ></textarea>

            <h2>Payment Details</h2>
            <input
              type="text"
              name="cardNumber"
              placeholder="Card Number (16 digits)"
              maxLength="16"
              value={formData.cardNumber}
              onChange={handleChange}
            />
            <div className="row">
              <input
                type="text"
                name="expiry"
                placeholder="MM/YY"
                maxLength="5"
                value={formData.expiry}
                onChange={handleChange}
              />
              <input
                type="text"
                name="cvc"
                placeholder="CVC"
                maxLength="3"
                value={formData.cvc}
                onChange={handleChange}
              />
            </div>

            <button className="primary" type="submit" disabled={loading}>
              {loading ? 'Processing…' : `Pay ${currency(total)}`}
            </button>
            {message && <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>{message}</div>}
          </form>

          <div className="checkout-summary">
            <h2>Order Summary</h2>
            <div className="summary-items">
              {cart.map((item) => (
                <div key={item.id} className="summary-item">
                  <div>
                    <strong>{item.name}</strong>
                    <span className="muted">{item.qty}×</span>
                  </div>
                  <strong>{currency(item.price * item.qty)}</strong>
                </div>
              ))}
            </div>
            <div className="summary-total">
              <strong>Total:</strong>
              <strong>{currency(total)}</strong>
            </div>
            <button className="secondary" onClick={onBackToCart}>Back to Cart</button>
          </div>
        </div>
      </div>
    </main>
  )
}
