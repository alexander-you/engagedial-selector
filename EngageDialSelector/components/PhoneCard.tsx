/**
 * Proactive Engagement Phone Selector — PhoneCard Component
 * Version: 1.0.7
 *
 * A compact, keyboard-accessible selectable row representing a single phone number.
 * Number is the primary visual element; label is secondary and right-aligned.
 *
 * Invalid phone numbers (failing E.164 validation) are rendered with:
 *  - A grayed-out disabled radio (visible but not active)
 *  - The original phone number and label unchanged
 *  - A subtle "Invalid phone number format." message below the number
 *  - No selection capability
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
      {/* Radio circle — always visible; grayed out when invalid */}
      <div className="engagedial-phone-card__radio" aria-hidden="true">
        <div className="engagedial-phone-card__radio-dot" />
      </div>

      {/* Content column: number + label row, then optional validation message */}
      <div className="engagedial-phone-card__content">
        <div className="engagedial-phone-card__info">
          <span className="engagedial-phone-card__number">{phone.number}</span>
          <span className="engagedial-phone-card__label">{phone.label}</span>
        </div>
        {!isValid && (
          <div className="engagedial-phone-card__invalid-msg" role="alert">
            Invalid phone number format.
          </div>
        )}
      </div>
    </div>
  );
};
