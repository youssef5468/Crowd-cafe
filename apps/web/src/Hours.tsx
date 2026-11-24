import { useEffect, useState } from 'react';
import { Clock, ArrowUpRight } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { isOpen } from '@crowd/shared/runtime';
import { seedBranch } from '@crowd/shared';
import { brand } from './brand';
export function Hours({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(() => isOpen(seedBranch));
  useEffect(() => {
    const timer = setInterval(() => setOpen(isOpen(seedBranch)), 60000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className={compact ? 'hours-inline' : 'hours-panel'}>
      {compact ? (
        <>
          <Clock size={16} aria-hidden="true" />
          <span>{t('dailyHours')}</span>
        </>
      ) : (
        <>
          <div className="hours-title">
            <Clock size={25} aria-hidden="true" />
            <h2>{t('openingHours')}</h2>
            {brand.showOpenStatus && (
              <span className="open-badge">{t(open ? 'openNow' : 'closedNow')}</span>
            )}
          </div>
          <div className="hours-time">
            <span>{t('daily')}</span>
            <strong>{t('hoursValue')}</strong>
          </div>
          <p className="muted">{t('closingNote')}</p>
          {brand.facebook && (
            <a className="text-link" href={brand.facebook} target="_blank" rel="noreferrer">
              {t('facebookAction')}
              <ArrowUpRight size={18} />
            </a>
          )}
        </>
      )}
    </div>
  );
}
