/**
 * UI Component Library
 * 
 * Shared, reusable UI components with consistent styling.
 * All components use design tokens and theme context.
 * 
 * Usage:
 * ```tsx
 * import { 
 *   Button, Card, Modal, Input, TextArea, Select, Checkbox,
 *   EmptyState, Spinner, LoadingOverlay, PageLoader, Skeleton 
 * } from '../components/ui';
 * 
 * <Card variant="elevated">
 *   <Card.Header>Form</Card.Header>
 *   <Card.Body>
 *     <Input label="Name" placeholder="Enter name" />
 *     <Select label="Type" options={types} />
 *   </Card.Body>
 *   <Card.Footer>
 *     <Button variant="primary">Save</Button>
 *   </Card.Footer>
 * </Card>
 * 
 * <EmptyState
 *   icon="📋"
 *   title="No tasks yet"
 *   action={{ label: "Create Task", onClick: handleCreate }}
 * />
 * 
 * <Spinner size="lg" />
 * <PageLoader message="Loading data..." />
 * ```
 */

// Button
export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

// Card
export { Card } from './Card';
export type { CardProps, CardVariant, CardPadding } from './Card';

// Modal
export { Modal } from './Modal';
export type { ModalProps, ModalSize } from './Modal';

// Input Components
export { Input, TextArea, Select, Checkbox } from './Input';
export type { InputProps, TextAreaProps, SelectProps, SelectOption, CheckboxProps } from './Input';

// EmptyState
export { EmptyState } from './EmptyState';
export type { EmptyStateProps, EmptyStateAction } from './EmptyState';

// Loading / Spinner
export { Spinner, LoadingOverlay, PageLoader, Skeleton, SkeletonText } from './Spinner';
export type { SpinnerProps, SpinnerSize, SpinnerColor, LoadingOverlayProps, PageLoaderProps, SkeletonProps, SkeletonTextProps } from './Spinner';

// PageHeader
export { PageHeader } from './PageHeader';
export type { PageHeaderProps, PageHeaderAction } from './PageHeader';

// Keyboard Shortcuts
export { KeyboardShortcutsOverlay } from './KeyboardShortcuts';
export type { KeyboardShortcutsOverlayProps, ShortcutItem } from './KeyboardShortcuts';

// BottomSheet (Mobile)
export { BottomSheet } from './BottomSheet';
export type { BottomSheetProps, BottomSheetHeight } from './BottomSheet';

// ContextMenu (Right-click / Long-press)
export { ContextMenu, useContextMenu } from './ContextMenu';
export type { ContextMenuProps, ContextMenuItem, ContextMenuDivider, ContextMenuItemOrDivider } from './ContextMenu';

// Collapsible / Accordion
export { Collapsible, Accordion } from './Collapsible';
export type { CollapsibleProps, AccordionProps } from './Collapsible';

// FormWizard
export { FormWizard, StepIndicator } from './FormWizard';
export type { FormWizardProps, WizardStep, StepIndicatorProps } from './FormWizard';

// Tabs
export { Tabs } from './Tabs';
export type { TabsProps, Tab, TabVariant } from './Tabs';

// QuickShare
export { QuickShare } from './QuickShare';
export type { QuickShareProps, ShareGroup, SharePermissions } from './QuickShare';
