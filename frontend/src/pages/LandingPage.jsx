import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <main className="landing-page">
      <section className="hero">
        <h1>AppliCache</h1>
        <p>
          Manage all your job applications in one place. Say goodbye to messy
          spreadsheets.
        </p>
        <div className="hero-actions">
          <Link to="/login" className="btn btn-secondary">
            Login
          </Link>
          <Link to="/signup" className="btn btn-primary">
            Sign Up
          </Link>
        </div>
      </section>
    </main>
  );
}
