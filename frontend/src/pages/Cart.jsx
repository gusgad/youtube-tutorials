import React from 'react'

function currency(cents) {
  return `$${(cents / 100).toFixed(2)}`
}

export default function Cart({ cart, onRemove, onCheckout, onContinueShopping }) {
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0)

  return (
    <main className="cart-page">
      <div className="cart-container">
        <h1>Shopping Cart</h1>
        {cart.length === 0 ? (
          <div className="empty-cart">
            <p>Your cart is empty</p>
            <button className="primary" onClick={onContinueShopping}>Continue Shopping</button>
          </div>
        ) : (
          <>
            <div className="cart-items-list">
              {cart.map((item) => (
                <div key={item.id} className="cart-item-row">
                  <img src={item.image} alt={item.name} />
                  <div className="item-details">
                    <h3>{item.name}</h3>
                    <p className="muted">{item.description}</p>
                  </div>
                  <div className="item-qty">
                    <label>Qty: {item.qty}</label>
                  </div>
                  <div className="item-price">
                    {currency(item.price * item.qty)}
                  </div>
                  <button className="btn-remove" onClick={() => onRemove(item.id)}>Remove</button>
                </div>
              ))}
            </div>

            <div className="cart-summary-section">
              <div className="total-row">
                <strong>Total:</strong>
                <strong>{currency(total)}</strong>
              </div>
              <div className="cart-actions">
                <button className="secondary" onClick={onContinueShopping}>Continue Shopping</button>
                <button className="primary" onClick={onCheckout}>Proceed to Checkout</button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
