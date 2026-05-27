/**
 * Proactive Engagement Phone Selector — PhoneCard Component
 * Version: 1.0.6
 *
 * A compact, keyboard-accessible selectable row representing a single phone number.
 * Number is the primary visual element; label is secondary and right-aligned.
 * Invalid phone numbers (failing E.164 validation) are rendered in a disabled
 * state with a warning indicator and are not selectable.
 */

import * as React from "react";
import { PhoneNumber } from "../types";

export interface IPhoneCardProps {
  phone: PhoneNumber;
  isSelected: boolean;
  onSelect: (number: string) => void;
}

export const PhoneCard: React.FC<IPhoneCardProps> = ({
  phone,
  isSelected,
  onSelect,
}) => {
  const { isValid } = phone;

  const handleClick = () => {
    if (isValid) onSelect(phone.number);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isValid) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(phone.number);
    }
  };

  const className = [
    "engagedial-phone-card",
    isSelected ? "engagedial-phone-card--selected" : "",
    !isValid ? "engagedial-phone-card--invalid" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
      role="radio"
      aria-checked={isSelected}
      aria-disabled={!isValid}
      tabIndex={isValid ? 0 : -1}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {/* Radio circle — hidden for invalid cards */}
      {isValid && (
        <div className="engagedial-phone-card__radio" aria-hidden="true">
          <div className="engagedial-phone-card__radio-dot" />
        </div>
      )}

      {/* Warning icon for invalid cards */}
      {!isValid && (
        <div className="engagedial-phone-card__invalid-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <path
              d="M10 2a8 8 0 1 0 0 16A8 8 0 0 0 10 2Zm0 4.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6.5Zm0 7a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75Z"
              fill="#C50F1F"
            />
          </svg>
        </div>
      )}

      {/* Number (primary) + label (secondary, right-aligned) */}
      <div className="engagedial-phone-card__info">
        <span className="engagedial-phone-card__number">{phone.number}</span>
        <span className="engagedial-phone-card__label">{phone.label}</span>
      </div>

      {/* Inline invalid message */}
      {!isValid && (
        <div className="engagedial-phone-card__invalid-msg">
          Invalid format
        </div>
      )}
    </div>
  );
};
