import React from 'react'

const services = [
  { name: 'Haircut', duration: '30 min', price: '200 ETB' },
  { name: 'Shave', duration: '20 min', price: '150 ETB' },
  { name: 'Beard Trim', duration: '15 min', price: '100 ETB' },
]

export default function App() {
  return (
    <div className="app">
      <header className="hero">
        <h1>Welcome to My Business</h1>
        <p>Book your next appointment online — fast and simple.</p>
        <button className="cta">Book Now</button>
      </header>

      <section className="services">
        <h2>Our Services</h2>
        <ul>
          {services.map((s) => (
            <li key={s.name} className="service">
              <div>
                <h3>{s.name}</h3>
                <span className="duration">{s.duration}</span>
              </div>
              <span className="price">{s.price}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer>
        <p>&copy; {new Date().getFullYear()} My Business</p>
      </footer>
    </div>
  )
}
