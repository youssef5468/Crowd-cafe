import { useRef } from 'react';
import { ImageSquare, UploadSimple, Trash } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

export function ProductImageField({
  value,
  uploading,
  disabled,
  onUpload,
  onRemove,
}: {
  value: string | null;
  uploading: boolean;
  disabled: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  return (
    <fieldset
      className="product-image-field"
      disabled={disabled || uploading}
      aria-busy={uploading}
    >
      <legend>{t('productPhoto')}</legend>
      <div className="product-image-layout">
        <div className="product-image-preview">
          {value ? (
            <img src={value} alt={t('photoPreview')} width="180" height="180" />
          ) : (
            <div>
              <ImageSquare size={38} weight="thin" aria-hidden="true" />
              <span>{t('noPhoto')}</span>
            </div>
          )}
        </div>
        <div className="product-image-controls">
          <p>{t('photoHelp')}</p>
          <div className="product-image-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => input.current?.click()}
            >
              <UploadSimple size={18} aria-hidden="true" />
              {t(uploading ? 'sending' : value ? 'replacePhoto' : 'upload')}
            </button>
            {value && (
              <button type="button" className="text-link" onClick={onRemove}>
                <Trash size={17} aria-hidden="true" />
                {t('removePhoto')}
              </button>
            )}
          </div>
          <input
            ref={input}
            type="file"
            hidden
            accept="image/jpeg,image/png,image/webp"
            aria-label={t('productPhoto')}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (file) onUpload(file);
            }}
          />
          <small role="status">{t(uploading ? 'photoUploading' : 'photoSaveHint')}</small>
        </div>
      </div>
    </fieldset>
  );
}
