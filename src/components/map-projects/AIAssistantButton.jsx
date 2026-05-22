import React from 'react'
import { useTranslation } from 'react-i18next';

import Button from '@mui/material/Button'
import ButtonGroup from '@mui/material/ButtonGroup'
import Grow from '@mui/material/Grow';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import ListSubheader from '@mui/material/ListSubheader';
import ListItemText from '@mui/material/ListItemText';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import IconButton from '@mui/material/IconButton';

import AssistantIcon from '@mui/icons-material/Assistant';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';

import find from 'lodash/find'
import filter from 'lodash/filter'
import orderBy from 'lodash/orderBy'

import AIAssistantSelectorPanel from './AIAssistantSelectorPanel'

const Model = ({ model, selected, onClick }) => {
  return (
    <MenuItem
      key={model.id}
      selected={model?.id === selected}
      onClick={event => onClick(event, model)}
    >
      <ListItemText primary={model.name} secondary={model.id} />
      {
        model.hugging_face_id &&
          <IconButton size='small' sx={{margin: '0 2px', color: 'yellow'}} onClick={event => {
            event.preventDefault()
            event.stopPropagation()
            window.open(`https://huggingface.co/${model.hugging_face_id}`, '_blank')
            return false
          }} href={`https://huggingface.co/${model.hugging_face_id}`} target='_blank' rel='noreferrer noopener'>
            <img src='https://huggingface.co/front/assets/huggingface_logo-noborder.svg' style={{width: '30px'}} />
          </IconButton>
      }
    </MenuItem>
  )
}


const AIAssistantButton = ({
  models,
  selected,
  onClick,
  onModelChange,
  popperProps,
  isCoreUser,
  promptTemplates,
  promptTemplate,
  onPromptTemplateChange,
  isInProgress,
  hasExistingAnalysis = false,
  isAnalysisOpen = false,
  onViewExistingAnalysis,
  disabled,
  ...rest
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false);
  const anchorRef = React.useRef(null);
  const [model, setModel] = React.useState(selected || find(models, {is_default: true})?.id || '')

  React.useEffect(() => {
    setModel(selected || find(models, {is_default: true})?.id || '')
  }, [selected])

  const handleToggle = event => {
    event.stopPropagation()
    event.preventDefault()
    setOpen((prevOpen) => !prevOpen)
  };

  const handleClose = (event) => {
    if(event?.stopPropagation)
      event.stopPropagation()
    if(event?.preventDefault)
      event.preventDefault()

    if (anchorRef.current && anchorRef.current.contains(event.target))
      return;

    setOpen(false);
  };

  const handleMenuItemClick = (
    event,
    newValue
  ) => {
    event.preventDefault()
    event.stopPropagation()
    event.persist()

    setModel(newValue?.id || '');
    onModelChange(newValue?.id)
    setOpen(false);
  };

  const handleSubmit = event => {
    event.preventDefault()
    event.stopPropagation()
    setOpen(false)
    onClick(event, model)
  }

  const handleViewExistingAnalysis = event => {
    event.preventDefault()
    event.stopPropagation()
    setOpen(false)
    onViewExistingAnalysis?.(event)
  }

  const recommendedOptions = filter(models, {is_recommended: true})
  const otherOptions = filter(models, {is_recommended: false})
  const offerExistingAnalysis = hasExistingAnalysis && !isAnalysisOpen

  if (isCoreUser && promptTemplates?.length) {
    return (
      <React.Fragment>
        <Button
          size='small'
          variant='outlined'
          ref={anchorRef}
          color='primary'
          onClick={handleToggle}
          startIcon={<AssistantIcon fontSize='inherit' sx={{marginTop: '-1px'}} />}
          disabled={disabled}
          {...rest}
          sx={{textTransform: 'none', whiteSpace: 'nowrap', paddingTop: '5px', ...rest.sx}}
        >
          {t('map_project.ai_assistant')}
        </Button>
        <Popper
          sx={{
            zIndex: 3,
          }}
          open={open}
          anchorEl={anchorRef.current}
          role={undefined}
          transition
          {...popperProps}
        >
          {({ TransitionProps, placement }) => (
            <Grow
              {...TransitionProps}
              style={{
                transformOrigin:
                placement === 'bottom' ? 'center top' : 'center bottom',
              }}
            >
              <Paper sx={{padding: '12px', maxWidth: '420px'}}>
                <ClickAwayListener onClickAway={handleClose}>
                  <div>
                    <AIAssistantSelectorPanel
                      promptTemplates={promptTemplates}
                      promptTemplate={promptTemplate}
                      onPromptTemplateChange={onPromptTemplateChange}
                      models={models}
                      selectedModel={model}
                      onModelChange={nextModel => {
                        setModel(nextModel)
                        onModelChange(nextModel)
                      }}
                      onSubmit={handleSubmit}
                      showSubmit
                      disabled={isInProgress}
                      secondaryActionLabel={offerExistingAnalysis ? t('map_project.view_existing_analysis') : undefined}
                      onSecondaryAction={offerExistingAnalysis ? handleViewExistingAnalysis : undefined}
                      sx={{border: 'none', padding: 0, minWidth: '360px'}}
                    />
                  </div>
                </ClickAwayListener>
              </Paper>
            </Grow>
          )}
        </Popper>
      </React.Fragment>
    )
  }

  return (
    <React.Fragment>
      <ButtonGroup
        size='small'
        variant="outlined"
        ref={anchorRef}
        aria-label="Button group AI models"
        color='primary'
        disabled={disabled || isInProgress}
        {...rest}
      >
        <Button
          size='small'
          sx={{textTransform: 'none', whiteSpace: 'nowrap', paddingTop: '5px'}}
          onClick={offerExistingAnalysis ? handleToggle : (event => onClick(event, model))}
          startIcon={<AssistantIcon fontSize='inherit' sx={{marginTop: '-1px'}} />}
        >
          {t('map_project.ai_assistant')}
        </Button>
        <Button
          size="small"
          aria-controls={open ? 'split-button-menu' : undefined}
          aria-expanded={open ? 'true' : undefined}
          aria-label="select merge strategy"
          aria-haspopup="menu"
          onClick={handleToggle}
          sx={{minWidth: 'auto !important', padding: '0px !important'}}
        >
          <ArrowDropDownIcon />
        </Button>
      </ButtonGroup>
      <Popper
        sx={{
          zIndex: 3,
        }}
        open={open}
        anchorEl={anchorRef.current}
        role={undefined}
        transition
        {...popperProps}
      >
        {({ TransitionProps, placement }) => (
          <Grow
            {...TransitionProps}
            style={{
              transformOrigin:
              placement === 'bottom' ? 'center top' : 'center bottom',
            }}
          >
            <Paper>
              <ClickAwayListener onClickAway={handleClose}>
                <MenuList id="split-button-menu" autoFocusItem sx={{textAlign: 'left', maxHeight: '400px', overflow: 'auto', paddingTop: 0, paddingBottom: 0, maxWidth: '500px'}}>
                  {
                    offerExistingAnalysis &&
                      <>
                        <MenuItem onClick={handleViewExistingAnalysis}>
                          {t('map_project.view_existing_analysis')}
                        </MenuItem>
                        <MenuItem onClick={handleSubmit}>
                          {t('map_project.run_new_analysis')}
                        </MenuItem>
                      </>
                  }
                  {
                    orderBy(recommendedOptions, 'name').length > 0 &&
                      <>
                        <ListSubheader sx={{fontSize: '12px', lineHeight: '32px', backgroundColor: 'rgb(237, 237, 237)'}}>
                          {t('map_project.recommended')}
                        </ListSubheader>
                        {
                          recommendedOptions.map(option => (
                            <Model key={option.id} model={option} selected={model} onClick={handleMenuItemClick} />
                          ))
                        }
                      </>
                  }
                  {
                    otherOptions.length > 0 &&
                      <>
                        <ListSubheader sx={{fontSize: '12px', lineHeight: '32px', backgroundColor: 'rgb(237, 237, 237)'}}>
                          {t('map_project.all_options')}
                        </ListSubheader>
                        {
                          orderBy(otherOptions, 'name').map(option => (
                            <Model key={option.id} model={option} selected={model} onClick={handleMenuItemClick} />
                          ))
                        }
                      </>
                  }
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Grow>
        )}
      </Popper>
    </React.Fragment>

  )
}


export default AIAssistantButton;
