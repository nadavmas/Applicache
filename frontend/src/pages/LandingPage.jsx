import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { getCurrentUser } from "aws-amplify/auth";

export default function LandingPage() {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then(() => {
        if (!cancelled) setStatus("authed");
      })
      .catch(() => {
        if (!cancelled) setStatus("guest");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "checking") {
    return (
      <main className="landing-page">
        <p
          className="hero__loading page-loading"
          role="status"
          aria-live="polite"
        >
          <span className="page-loading__label">Loading</span>
          <span className="page-loading__dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </p>
      </main>
    );
  }

  if (status === "authed") {
    return <Navigate to="/dashboard" replace />;
  }

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
