/**
 * Proactive Engagement Phone Selector — PhoneCard Component
 * Version: 1.0.1
 *
 * A compact, keyboard-accessible selectable row representing a single phone number.
 * Number is the primary visual element; label is secondary and right-aligned.
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
  const handleClick = () => onSelect(phone.number);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(phone.number);
    }
  };

  return (
    <div
      className={`engagedial-phone-card${isSelected ? " engagedial-phone-card--selected" : ""}`}
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {/* Radio circle */}
      <div className="engagedial-phone-card__radio" aria-hidden="true">
        <div className="engagedial-phone-card__radio-dot" />
      </div>

      {/* Number (primary) + label (secondary, right-aligned) */}
      <div className="engagedial-phone-card__info">
        <span className="engagedial-phone-card__number">{phone.number}</span>
        <span className="engagedial-phone-card__label">{phone.label}</span>
      </div>
    </div>
  );
};
