import { forwardRef, useId } from 'react';
import { useTranslation } from 'react-i18next';
import * as Select from '@radix-ui/react-select';
import { CaretDown, CaretUp, Check } from '@phosphor-icons/react';

type SelectOption = { value: string; label: string; disabled?: boolean };
type SelectInputProps = {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  name?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
};

export const SelectInput = forwardRef<HTMLButtonElement, SelectInputProps>(function SelectInput(
  {
    options,
    value,
    defaultValue,
    onValueChange,
    onBlur,
    placeholder,
    name,
    id,
    disabled,
    required,
    'aria-label': label,
    'aria-invalid': invalid,
  },
  ref,
) {
  const { i18n, t } = useTranslation();
  const generatedId = useId();
  return (
    <Select.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      name={name}
      disabled={disabled}
      required={required}
      dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}
    >
      <Select.Trigger
        ref={ref}
        id={id ?? generatedId}
        className="select-trigger"
        aria-label={label}
        aria-invalid={invalid}
        onBlur={onBlur}
      >
        <Select.Value placeholder={placeholder ?? t('select')} />
        <Select.Icon asChild>
          <CaretDown className="select-chevron" size={16} aria-hidden="true" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="select-content"
          position="popper"
          sideOffset={7}
          collisionPadding={16}
        >
          <Select.ScrollUpButton className="select-scroll">
            <CaretUp size={16} aria-hidden="true" />
          </Select.ScrollUpButton>
          <Select.Viewport className="select-viewport">
            {options.map((option) => (
              <Select.Item
                className="select-item"
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator className="select-indicator">
                  <Check size={16} weight="bold" aria-hidden="true" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="select-scroll">
            <CaretDown size={16} aria-hidden="true" />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
});
