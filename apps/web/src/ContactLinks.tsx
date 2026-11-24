import { FacebookLogo, InstagramLogo, Phone } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useCafe } from './context';

export function ContactLinks({ includeWhatsapp = true }: { includeWhatsapp?: boolean }) {
  const { t } = useTranslation();
  const { data } = useCafe();
  const phone = data.branches.find((branch) => branch.phone)?.phone;
  const showWhatsapp = includeWhatsapp && phone && data.settings.whatsappEnabled;
  if (!data.settings.instagram && !data.settings.facebook && !showWhatsapp) return null;
  return (
    <div className="social-links">
      {data.settings.instagram && (
        <a href={data.settings.instagram} target="_blank" rel="noreferrer">
          <InstagramLogo size={22} aria-hidden="true" />
          <span>{t('socialInstagram')}</span>
        </a>
      )}
      {data.settings.facebook && (
        <a href={data.settings.facebook} target="_blank" rel="noreferrer">
          <FacebookLogo size={22} aria-hidden="true" />
          <span>{t('socialFacebook')}</span>
        </a>
      )}
      {showWhatsapp && (
        <a href={`https://wa.me/${phone.replace('+', '')}`} target="_blank" rel="noreferrer">
          <Phone size={21} aria-hidden="true" />
          <span>{t('socialWhatsapp')}</span>
        </a>
      )}
    </div>
  );
}
