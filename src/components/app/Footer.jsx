import React from 'react';
import { useTranslation } from 'react-i18next';
import { Divider, Link } from '@mui/material';
import { Copyright as CopyrightIcon } from '@mui/icons-material';
import { get } from 'lodash';
import {
  getAppliedServerConfig
} from '../../common/utils';
import { COMMUNITY_SITE_URL, TERMS_OF_USE_URL, PRIVACY_POLICY_URL } from '../../common/constants';
import AppVersions from './AppVersions';
import './Footer.scss';

const DEFAULT_FOOTER_TEXT = `${new Date().getFullYear()} Open Concept Lab`;

// Bootstrap's a:hover and a:focus color would otherwise win over MUI's
const LEGAL_LINK_SX = { whiteSpace: 'nowrap', '&:hover, &:focus': { color: 'primary.main' } };

// The footer's height in Footer.scss while it fits on one row. Narrower
// screens stack it onto more rows, and --app-height in index.scss subtracts
// the extra, so pages end above it.
const ROW_HEIGHT = 30;
const EXTRA_HEIGHT_VAR = '--footer-extra-height';

const Footer = () => {
  const { t } = useTranslation();
  const ref = React.useRef(null);
  const text = get(getAppliedServerConfig(), 'info.site.footerText', DEFAULT_FOOTER_TEXT);
  const isDefault = text === DEFAULT_FOOTER_TEXT;

  React.useLayoutEffect(() => {
    const el = ref.current;
    const root = document.documentElement.style;
    const update = () => root.setProperty(EXTRA_HEIGHT_VAR, `${Math.max(0, el.offsetHeight - ROW_HEIGHT)}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.removeProperty(EXTRA_HEIGHT_VAR);
    };
  }, []);

  return (
    <footer ref={ref} className='col-sm-12 footer-container flex-vertical-center' style={{textAlign: 'right'}}>
      {/* On every page, signed in or not: using the Mapper means accepting the Terms of Use */}
      <div className='footer-legal flex-vertical-center'>
        <Link href={COMMUNITY_SITE_URL} target='_blank' rel='noopener noreferrer' underline='hover' sx={LEGAL_LINK_SX}>{t('common.community_website')}</Link>
        <Divider orientation='vertical' className='footer-divider-vertical' />
        <Link href={TERMS_OF_USE_URL} target='_blank' rel='noopener noreferrer' underline='hover' sx={LEGAL_LINK_SX}>{t('common.terms_of_use')}</Link>
        <Divider orientation='vertical' className='footer-divider-vertical' />
        <Link href={PRIVACY_POLICY_URL} target='_blank' rel='noopener noreferrer' underline='hover' sx={LEGAL_LINK_SX}>{t('common.privacy_policy')}</Link>
      </div>
      <Divider orientation='vertical' className='footer-divider-vertical' />
      <span className='flex-vertical-center'>
        {
          isDefault &&
          <CopyrightIcon fontSize='small'/>
        }
        <span className='footer-company'>{text}</span>
      </span>
      <Divider orientation='vertical' className='footer-divider-vertical' />
      <AppVersions />
    </footer>
  );

}

export default Footer;
