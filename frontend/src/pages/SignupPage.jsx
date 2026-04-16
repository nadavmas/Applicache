import { useState } from "react";
import { Link } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import {
  signUp,
  confirmUserSignUp,
  resendUserVerificationCode,
} from "../auth/cognitoSignup.js";
import {
  COGNITO_PASSWORD_RULES_MESSAGE,
  passwordMeetsCognitoPoolRules,
} from "../auth/cognitoAuthErrors.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Cognito-style username: letters, numbers, . _ - */
const USERNAME_RE = /^[a-zA-Z0-9._-]{3,128}$/;

function parseDateOnly(value) {
  if (!value) return null;
  const d = new Date(value + "T12:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

function validateSignup(values) {
  const {
    firstName,
    lastName,
    dateOfBirth,
    username,
    email,
    password,
    confirmPassword,
  } = values;
  const next = {};

  if (!firstName.trim()) next.firstName = "First name is required.";
  if (!lastName.trim()) next.lastName = "Last name is required.";

  if (!dateOfBirth) next.dateOfBirth = "Date of birth is required.";
  else {
    const dob = parseDateOnly(dateOfBirth);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (!dob) next.dateOfBirth = "Enter a valid date.";
    else if (dob > today) next.dateOfBirth = "Date cannot be in the future.";
    else {
      const min = new Date(1900, 0, 1);
      if (dob < min) next.dateOfBirth = "Enter a realistic date of birth.";
    }
  }

  const u = username.trim();
  if (!u) next.username = "Username is required.";
  else if (!USERNAME_RE.test(u))
    next.username =
      "Use 3–128 characters: letters, numbers, periods, underscores, or hyphens.";

  if (!email.trim()) next.email = "Email is required.";
  else if (!EMAIL_RE.test(email.trim()))
    next.email = "Enter a valid email address.";

  if (!password) next.password = "Password is required.";
  else if (!passwordMeetsCognitoPoolRules(password))
    next.password = COGNITO_PASSWORD_RULES_MESSAGE;

  if (!confirmPassword) next.confirmPassword = "Confirm your password.";
  else if (password !== confirmPassword)
    next.confirmPassword = "Passwords do not match.";

  return next;
}

export default function SignupPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  /** @type {'signup' | 'verify' | 'complete'} */
  const [uiStep, setUiStep] = useState("signup");
  const [verificationCode, setVerificationCode] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [verifyFieldError, setVerifyFieldError] = useState("");
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  const clearField = (key) => {
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    const next = validateSignup({
      firstName,
      lastName,
      dateOfBirth,
      username,
      email,
      password,
      confirmPassword,
    });
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      const result = await signUp({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth,
        username: username.trim(),
        email: email.trim(),
        password,
      });
      if (result.needsEmailConfirmation) {
        setVerificationCode("");
        setVerifyError("");
        setVerifyFieldError("");
        setResendMessage("");
        setUiStep("verify");
      } else {
        setUiStep("complete");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Try again.";
      const field = /** @type {{ field?: string }} */ (err)?.field;
      if (field === "password") {
        setFieldErrors((prev) => ({ ...prev, password: message }));
      } else {
        setFormError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    setVerifyError("");
    setVerifyFieldError("");
    setResendMessage("");
    const code = verificationCode.trim();
    if (!code) {
      setVerifyFieldError("Enter the verification code from your email.");
      return;
    }

    setVerifySubmitting(true);
    try {
      await confirmUserSignUp({
        username: username.trim(),
        confirmationCode: code,
      });
      setUiStep("complete");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Try again.";
      const field = /** @type {{ field?: string }} */ (err)?.field;
      if (field === "confirmationCode") {
        setVerifyFieldError(message);
      } else {
        setVerifyError(message);
      }
    } finally {
      setVerifySubmitting(false);
    }
  };

  const handleResendCode = async () => {
    setVerifyError("");
    setVerifyFieldError("");
    setResendMessage("");
    setResending(true);
    try {
      await resendUserVerificationCode({ username: username.trim() });
      setResendMessage("We sent a new code to your email.");
    } catch (err) {
      setVerifyError(
        err instanceof Error ? err.message : "Could not resend the code.",
      );
    } finally {
      setResending(false);
    }
  };

  if (uiStep === "complete") {
    return (
      <AuthLayout
        title="You’re all set"
        subtitle="Your email is verified. You can sign in with your username or email."
        footer={
          <>
            <Link to="/login">Go to login</Link>
          </>
        }
      />
    );
  }

  if (uiStep === "verify") {
    return (
      <AuthLayout
        title="Verify your email"
        subtitle={`Enter the verification code we sent to ${email.trim() || "your email"}.`}
        footer={
          <>
            Wrong address? You’ll need to{" "}
            <button
              type="button"
              className="auth-link"
              onClick={() => {
                setUiStep("signup");
                setVerificationCode("");
                setVerifyError("");
                setVerifyFieldError("");
                setResendMessage("");
              }}
            >
              go back
            </button>{" "}
            and sign up again.
          </>
        }
      >
        <form className="auth-form" onSubmit={handleVerifySubmit} noValidate>
          {verifyError ? (
            <p className="auth-form-error" role="alert">
              {verifyError}
            </p>
          ) : null}
          {resendMessage ? (
            <p className="auth-card__subtitle auth-card__subtitle--compact">
              {resendMessage}
            </p>
          ) : null}

          <div className="auth-field">
            <label htmlFor="signup-verify-code">Verification code</label>
            <p id="signup-verify-hint" className="auth-field-hint">
              Check your inbox and spam folder. The code is usually 6 digits.
            </p>
            <input
              id="signup-verify-code"
              name="confirmationCode"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="auth-input"
              value={verificationCode}
              onChange={(e) => {
                setVerificationCode(e.target.value);
                if (verifyFieldError) setVerifyFieldError("");
              }}
              aria-invalid={Boolean(verifyFieldError)}
              aria-describedby={
                verifyFieldError
                  ? "signup-verify-code-error"
                  : "signup-verify-hint"
              }
            />
            {verifyFieldError ? (
              <p
                id="signup-verify-code-error"
                className="auth-field-error"
                role="alert"
              >
                {verifyFieldError}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn--block"
            disabled={verifySubmitting || resending}
          >
            {verifySubmitting ? "Verifying…" : "Verify and continue"}
          </button>

          <p className="auth-footer auth-footer--flush">
            Didn&apos;t get a code?{" "}
            <button
              type="button"
              className="auth-link"
              onClick={handleResendCode}
              disabled={resending || verifySubmitting}
            >
              {resending ? "Sending…" : "Resend code"}
            </button>
          </p>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start managing your applications in one place."
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {formError ? (
          <p className="auth-form-error" role="alert">
            {formError}
          </p>
        ) : null}

        <div className="auth-row">
          <div className="auth-field">
            <label htmlFor="signup-first-name">First name</label>
            <input
              id="signup-first-name"
              name="firstName"
              type="text"
              autoComplete="given-name"
              className="auth-input"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                if (fieldErrors.firstName) clearField("firstName");
              }}
              aria-invalid={Boolean(fieldErrors.firstName)}
              aria-describedby={
                fieldErrors.firstName ? "signup-first-name-error" : undefined
              }
            />
            {fieldErrors.firstName ? (
              <p
                id="signup-first-name-error"
                className="auth-field-error"
                role="alert"
              >
                {fieldErrors.firstName}
              </p>
            ) : null}
          </div>
          <div className="auth-field">
            <label htmlFor="signup-last-name">Last name</label>
            <input
              id="signup-last-name"
              name="lastName"
              type="text"
              autoComplete="family-name"
              className="auth-input"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                if (fieldErrors.lastName) clearField("lastName");
              }}
              aria-invalid={Boolean(fieldErrors.lastName)}
              aria-describedby={
                fieldErrors.lastName ? "signup-last-name-error" : undefined
              }
            />
            {fieldErrors.lastName ? (
              <p
                id="signup-last-name-error"
                className="auth-field-error"
                role="alert"
              >
                {fieldErrors.lastName}
              </p>
            ) : null}
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor="signup-dob">Date of birth</label>
          <input
            id="signup-dob"
            name="dateOfBirth"
            type="date"
            className="auth-input"
            value={dateOfBirth}
            onChange={(e) => {
              setDateOfBirth(e.target.value);
              if (fieldErrors.dateOfBirth) clearField("dateOfBirth");
            }}
            aria-invalid={Boolean(fieldErrors.dateOfBirth)}
            aria-describedby={
              fieldErrors.dateOfBirth ? "signup-dob-error" : undefined
            }
          />
          {fieldErrors.dateOfBirth ? (
            <p id="signup-dob-error" className="auth-field-error" role="alert">
              {fieldErrors.dateOfBirth}
            </p>
          ) : null}
        </div>

        <div className="auth-field">
          <label htmlFor="signup-username">Username</label>
          <input
            id="signup-username"
            name="username"
            type="text"
            autoComplete="username"
            className="auth-input"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (fieldErrors.username) clearField("username");
            }}
            aria-invalid={Boolean(fieldErrors.username)}
            aria-describedby={
              fieldErrors.username ? "signup-username-error" : undefined
            }
          />
          {fieldErrors.username ? (
            <p
              id="signup-username-error"
              className="auth-field-error"
              role="alert"
            >
              {fieldErrors.username}
            </p>
          ) : null}
        </div>

        <div className="auth-field">
          <label htmlFor="signup-email">Email</label>
          <input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            className="auth-input"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) clearField("email");
            }}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "signup-email-error" : undefined}
          />
          {fieldErrors.email ? (
            <p id="signup-email-error" className="auth-field-error" role="alert">
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        <div className="auth-field">
          <label htmlFor="signup-password">Password</label>
          <p id="signup-password-hint" className="auth-field-hint">
            {COGNITO_PASSWORD_RULES_MESSAGE}
          </p>
          <input
            id="signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            className="auth-input"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) clearField("password");
            }}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={
              fieldErrors.password
                ? "signup-password-error"
                : "signup-password-hint"
            }
          />
          {fieldErrors.password ? (
            <p
              id="signup-password-error"
              className="auth-field-error"
              role="alert"
            >
              {fieldErrors.password}
            </p>
          ) : null}
        </div>

        <div className="auth-field">
          <label htmlFor="signup-confirm">Confirm password</label>
          <input
            id="signup-confirm"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            className="auth-input"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (fieldErrors.confirmPassword) clearField("confirmPassword");
            }}
            aria-invalid={Boolean(fieldErrors.confirmPassword)}
            aria-describedby={
              fieldErrors.confirmPassword ? "signup-confirm-error" : undefined
            }
          />
          {fieldErrors.confirmPassword ? (
            <p
              id="signup-confirm-error"
              className="auth-field-error"
              role="alert"
            >
              {fieldErrors.confirmPassword}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          className="btn btn-primary btn--block"
          disabled={submitting}
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
