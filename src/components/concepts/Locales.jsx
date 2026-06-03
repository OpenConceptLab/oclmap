import React from 'react'
import { useTranslation } from 'react-i18next';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import CopyIcon from '@mui/icons-material/ContentCopy';
import PreferredIcon from '@mui/icons-material/FlagOutlined';
import { groupBy, forEach, has, compact, without, keys, orderBy, map } from 'lodash'
import { toFullAPIURL, copyURL } from '../../common/utils';
import TagCountLabel from '../common/TagCountLabel';
import { OperationsContext } from '../app/LayoutContext';
import ExternalIdLabel from '../common/ExternalIdLabel';

// BCP-47 primary subtag, lowercase, for locale comparison (e.g. "pt-BR" -> "pt").
const primarySubtag = tag => (typeof tag === 'string' ? tag.split('-')[0].toLowerCase() : '')

const borderColor = 'rgba(0, 0, 0, 0.12)'

const LocalePrimary = ({ locale }) => {
  const locale_type = locale.name_type || locale.description_type
  return (
    <React.Fragment>
      <Typography component="span" sx={{fontSize: '0.875rem', color: '#000000de'}} className={locale?.name ? 'searchable' : undefined}>
        {locale.name || locale.description}
      </Typography>
      {
        Boolean(locale_type) &&
          <Chip
            label={locale_type}
            size='small'
            sx={{
              height: '20px',
              borderRadius: '4px',
              backgroundColor: '#e4e1ec',
              fontSize: '0.875rem',
              color: 'surface.dark',
              marginLeft: '8px',
              '.MuiChip-label': {
                padding: '0 6px',
                fontSize: '12px'
              }
            }}
          />
      }
      {
        locale.locale_preferred &&
          <PreferredIcon fontSize='small' sx={{color: 'surface.contrastText', marginLeft: '8px', height: '16px'}}/>
      }
    </React.Fragment>
  )
}

const LocaleItem = ({ locale, url }) => {
  const { t } = useTranslation()
  const { setAlert } = React.useContext(OperationsContext);

  const externalID = (locale?.external_id && locale.external_id.toLowerCase() !== 'none') ? locale.external_id : undefined
  const isName = Boolean(locale?.name)
  const urlAttr = isName ? 'names' : 'descriptions'

  const onCopyClick = () => {
    copyURL(toFullAPIURL(url + urlAttr + '/' + locale.uuid + '/'))
    const message = isName ? t('concept.copied_name') : t('concept.copied_description')
    setAlert({message: message, severity: 'success', duration: 2000})
  }

  return (
    <React.Fragment>
      <ListItem
        sx={{color: 'surface.contrastText', paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: '24px' }}
        secondaryAction={
          <IconButton edge="end" aria-label="copy" sx={{color: 'surface.contrastText'}} onClick={onCopyClick} size='small'>
            <CopyIcon fontSize='inherit' />
          </IconButton>
        }
      >
        <ListItemText
          primary={<LocalePrimary locale={locale} />}
          secondary={externalID ? <ExternalIdLabel showFull value={externalID} style={{marginTop: '4px'}} iconStyle={{marginTop: '2px'}} /> : undefined}
          sx={{
            margin: '2px 0',
          }}
        />
      </ListItem>
      <Divider component="li" />
    </React.Fragment>
  )
}


const LocaleList = ({url, lang, locales}) => {
  return (
    <React.Fragment key={lang}>
      <ListItem sx={{color: 'surface.contrastText', paddingRight: 0, position: 'relative'}}>
        <ListItemAvatar sx={{color: 'surface.contrastText', position: 'absolute', height: 'calc(100% - 10px)'}}>
          {/* Render the locale code as stored — BCP-47 casing is meaningful
              (language subtag lowercase, region uppercase, e.g. de-DE), so don't force-uppercase. */}
          {lang}
        </ListItemAvatar>
        <List
          dense
          sx={{
            p: 0,
            width: '100%',
            marginLeft: '56px',
            '.MuiDivider-root:last-child': {display: 'none'},
            '.MuiListItemText-secondary': {fontSize: '0.675rem'},
          }}
        >
          {
            locales.map(
              locale => <LocaleItem key={locale.uuid} locale={locale} url={url} />
            )
          }
        </List>
      </ListItem>
      <Divider component="li" />
    </React.Fragment>
  )

}

const Locales = ({ concept, locales, title, repo, effectiveLocales, collapsible }) => {
  const { t } = useTranslation()
  const url = concept?.version_url || concept?.url

  // Apply the project's effective-locale filter (union of input_locale +
  // filters.locale) when provided AND collapsible — mirrors the AI Assistant
  // payload filter (filterAndTrimNames in map-projects/normalizers.js). When
  // a filter is active we render a "See N more" toggle so users can expand
  // to the full list. Outside the panel (no effectiveLocales / not
  // collapsible), behavior is unchanged — render everything.
  const filterSet = React.useMemo(() => {
    if(!collapsible || !Array.isArray(effectiveLocales) || effectiveLocales.length === 0) return null
    const s = new Set()
    for(const tag of effectiveLocales) {
      const t2 = primarySubtag(tag)
      if(t2) s.add(t2)
    }
    return s.size > 0 ? s : null
  }, [collapsible, effectiveLocales])

  const [showAll, setShowAll] = React.useState(false)
  const filtered = React.useMemo(() => {
    if(!filterSet || showAll) return locales
    return (locales || []).filter(l => {
      if(!l) return false
      if(!l.locale) return true  // defensive: entries with no locale survive (mirrors filterAndTrimNames)
      return filterSet.has(primarySubtag(l.locale))
    })
  }, [filterSet, showAll, locales])

  const totalCount = locales?.length || 0
  const filteredCount = filtered?.length || 0
  const hiddenCount = totalCount - filteredCount

  const groupLocales = (locales, repo) => {
    const groupedByRepo = {defaultLocales: {}, supportedLocales: {}, rest: {}}
    const grouped = groupBy(locales, 'locale')
    const supportedLocales = repo?.supported_locales || []

    if(grouped[repo.default_locale])
      groupedByRepo.defaultLocales[repo.default_locale] = grouped[repo.default_locale]

    forEach(supportedLocales, locale => {
      if(locale !== repo.default_locale && has(grouped, locale))
        groupedByRepo.supportedLocales[locale] = grouped[locale]
    })

    forEach(
      without(keys(grouped), ...compact([repo?.default_locale, ...supportedLocales])),
      locale => {
        if(has(grouped, locale))
          groupedByRepo.rest[locale] = grouped[locale]
      }
    )

    return groupedByRepo
  }

  const grouped = groupLocales(filtered, repo)
  const getOrdered = _locales => orderBy(_locales, ['locale_preferred', 'name_type', 'description_type', 'name'], ['desc', 'asc', 'asc'])

  return (
    <Paper className='col-xs-12 padding-0' sx={{boxShadow: 'none', border: '1px solid', borderColor: borderColor, borderRadius: '10px'}}>
      <Typography component='span' sx={{borderBottom: '1px solid', borderColor: borderColor, padding: '12px 16px', fontSize: '16px', color: 'surface.contrastText', display: 'flex', justifyContent: 'space-between'}}>
        <TagCountLabel label={title} count={filterSet && !showAll ? filteredCount : totalCount}/>
      </Typography>
      <List
        dense
        sx={{
          p: 0,
          '.MuiDivider-root:last-child': {display: 'none'},
          '.MuiListItemText-secondary': {fontSize: '0.675rem'},
        }}
      >
        {
          map(
            grouped.defaultLocales,
            (_locales, lang) => <LocaleList key={lang} url={url} lang={lang} locales={getOrdered(_locales)} />
          )
        }
        {
          map(
            grouped.supportedLocales,
            (_locales, lang) => <LocaleList key={lang} url={url} lang={lang} locales={getOrdered(_locales)} />
          )
        }
        {
          map(
            grouped.rest,
            (_locales, lang) => <LocaleList key={lang} url={url} lang={lang} locales={getOrdered(_locales)} />
          )
        }
      </List>
      {
        filterSet && (hiddenCount > 0 || showAll) && (
          <div style={{padding: '8px 16px', borderTop: '1px solid', borderColor: borderColor}}>
            <Button
              size='small'
              color='primary'
              onClick={() => setShowAll(s => !s)}
              sx={{textTransform: 'none'}}
            >
              {
                showAll
                  ? t('concept.show_fewer_locales')
                  : t('concept.show_more_locales', { count: hiddenCount })
              }
            </Button>
          </div>
        )
      }
    </Paper>
  )
}

export default Locales;
