/**
 * FormWizard Component
 * 
 * Multi-step form wizard for breaking long forms into manageable steps.
 * Shows progress indicator and handles navigation between steps.
 * 
 * Usage:
 * ```tsx
 * <FormWizard
 *   steps={[
 *     { id: 'basic', title: 'Basic Info', icon: '📝' },
 *     { id: 'details', title: 'Details', icon: '📋' },
 *     { id: 'review', title: 'Review', icon: '✅' },
 *   ]}
 *   currentStep={step}
 *   onStepChange={setStep}
 *   onComplete={handleSubmit}
 * >
 *   {step === 0 && <BasicInfoForm />}
 *   {step === 1 && <DetailsForm />}
 *   {step === 2 && <ReviewForm />}
 * </FormWizard>
 * ```
 */

import React, { ReactNode, CSSProperties } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { RADIUS, SPACING, SHADOW } from '../../constants/design-tokens';
import { Button } from './Button';
import { haptic } from '../../utils/haptic';

export interface WizardStep {
  id: string;
  title: string;
  icon?: ReactNode;
  description?: string;
  optional?: boolean;
}

export interface FormWizardProps {
  steps: WizardStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
  onComplete?: () => void;
  onCancel?: () => void;
  children: ReactNode;
  showStepNumbers?: boolean;
  allowSkip?: boolean;
  nextLabel?: string;
  prevLabel?: string;
  completeLabel?: string;
  cancelLabel?: string;
  isNextDisabled?: boolean;
  isLoading?: boolean;
  style?: CSSProperties;
  className?: string;
}

export const FormWizard: React.FC<FormWizardProps> = ({
  steps,
  currentStep,
  onStepChange,
  onComplete,
  onCancel,
  children,
  showStepNumbers = true,
  allowSkip = false,
  nextLabel = 'Next',
  prevLabel = 'Back',
  completeLabel = 'Complete',
  cancelLabel = 'Cancel',
  isNextDisabled = false,
  isLoading = false,
  style,
  className,
}) => {
  const { theme } = useTheme();
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      haptic.success();
      onComplete?.();
    } else {
      haptic.light();
      onStepChange(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      haptic.light();
      onStepChange(currentStep - 1);
    }
  };

  const handleStepClick = (index: number) => {
    if (index < currentStep || allowSkip) {
      haptic.light();
      onStepChange(index);
    }
  };

  return (
    <div className={className} style={style}>
      {/* Progress Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `${SPACING[4]} ${SPACING[2]}`,
          marginBottom: SPACING[4],
          overflowX: 'auto',
        }}
      >
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          const isClickable = isCompleted || allowSkip;

          return (
            <React.Fragment key={step.id}>
              {/* Step indicator */}
              <div
                onClick={() => isClickable && handleStepClick(index)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: SPACING[1],
                  cursor: isClickable ? 'pointer' : 'default',
                  opacity: isActive || isCompleted ? 1 : 0.5,
                  transition: 'all 0.2s ease',
                  minWidth: '80px',
                }}
              >
                {/* Circle */}
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isActive
                      ? (theme.gradient.textColor
                          ? theme.colors.primary
                          : `linear-gradient(135deg, ${theme.gradient.from}, ${theme.gradient.to})`)
                      : isCompleted
                      ? theme.colors.success
                      : theme.colors.background,
                    border: isActive || isCompleted
                      ? 'none'
                      : `2px solid ${theme.colors.cardBorder}`,
                    color: isActive || isCompleted ? 'white' : theme.colors.textLight,
                    fontWeight: 600,
                    fontSize: step.icon ? '1.25rem' : '0.875rem',
                    boxShadow: isActive ? SHADOW.md : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {isCompleted ? '✓' : step.icon || (showStepNumbers ? index + 1 : '')}
                </div>

                {/* Label */}
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? theme.colors.primary : theme.colors.textLight,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {step.title}
                </span>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: '2px',
                    minWidth: '20px',
                    maxWidth: '60px',
                    background: index < currentStep
                      ? theme.colors.success
                      : theme.colors.cardBorder,
                    margin: `0 ${SPACING[2]}`,
                    marginBottom: '24px',
                    transition: 'background 0.2s ease',
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Current step description */}
      {steps[currentStep]?.description && (
        <p
          style={{
            textAlign: 'center',
            color: theme.colors.textLight,
            marginBottom: SPACING[4],
            fontSize: '0.875rem',
          }}
        >
          {steps[currentStep].description}
        </p>
      )}

      {/* Step content */}
      <div style={{ marginBottom: SPACING[6] }}>
        {children}
      </div>

      {/* Navigation buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: SPACING[3],
          paddingTop: SPACING[4],
          borderTop: `1px solid ${theme.colors.cardBorder}`,
        }}
      >
        <div>
          {onCancel && isFirstStep && (
            <Button variant="ghost" onClick={onCancel}>
              {cancelLabel}
            </Button>
          )}
          {!isFirstStep && (
            <Button variant="secondary" onClick={handlePrev}>
              ← {prevLabel}
            </Button>
          )}
        </div>

        <div style={{ display: 'flex', gap: SPACING[2] }}>
          {steps[currentStep]?.optional && !isLastStep && (
            <Button variant="ghost" onClick={() => onStepChange(currentStep + 1)}>
              Skip
            </Button>
          )}
          <Button
            variant="primary"
            onClick={handleNext}
            disabled={isNextDisabled}
            loading={isLoading && isLastStep}
          >
            {isLastStep ? completeLabel : `${nextLabel} →`}
          </Button>
        </div>
      </div>
    </div>
  );
};

/**
 * Simple step indicator without navigation
 */
export interface StepIndicatorProps {
  steps: number;
  currentStep: number;
  size?: 'sm' | 'md';
  style?: CSSProperties;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  steps,
  currentStep,
  size = 'md',
  style,
}) => {
  const { theme } = useTheme();
  const dotSize = size === 'sm' ? '8px' : '12px';
  const gap = size === 'sm' ? SPACING[1] : SPACING[2];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap,
        ...style,
      }}
    >
      {Array.from({ length: steps }).map((_, index) => (
        <div
          key={index}
          style={{
            width: index === currentStep ? (size === 'sm' ? '20px' : '28px') : dotSize,
            height: dotSize,
            borderRadius: RADIUS.full,
            background: index === currentStep
              ? theme.colors.primary
              : index < currentStep
              ? theme.colors.success
              : theme.colors.cardBorder,
            transition: 'all 0.2s ease',
          }}
        />
      ))}
    </div>
  );
};

export default FormWizard;
