import React, { useRef } from 'react'

function currency(cents) {
  return `$${(cents / 100).toFixed(2)}`
}

export default function Shop({ products, onAddToCart, onViewCart }) {
  const productsRef = useRef(null)

  function scrollToProducts() {
    if (productsRef.current) productsRef.current.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <div className="hero" style={{ backgroundImage: `url(https://source.unsplash.com/1600x600/?shopping,store)` }}>
        <div className="hero-inner">
          <h2>Beautiful goods, thoughtfully made</h2>
          <p>Curated everyday essentials — designed to last.</p>
          <div className="hero-actions">
            <button className="primary" onClick={scrollToProducts}>Shop now</button>
          </div>
        </div>
      </div>

      <main className="content">
        <section className="products" ref={productsRef}>
          {products.map((p) => (
            <article className="card" key={p.id}>
              <div className="media">
                <img src={p.image} alt={p.name} />
              </div>
              <div className="card-body">
                <h3>{p.name}</h3>
                <p className="muted">{p.description}</p>
                <div className="row">
                  <strong>{currency(p.price)}</strong>
                  <button onClick={() => onAddToCart(p)}>Add to cart</button>
                </div>
              </div>
            </article>
          ))}
        </section>
      </main>
    </>
  )
}
