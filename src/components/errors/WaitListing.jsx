import React from 'react';
import { useTranslation } from 'react-i18next'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';

import { getLoginURL, getRegisterURL } from '../../common/utils'

// Renamed in spirit, not in file: this used to be the "coming soon" waitlist
// splash for anonymous visitors. There is no waitlist any more (R1) - every
// OCL account gets a Mapper preview automatically - so this is now the
// sign-in prompt that tells an anonymous visitor what they'd get.
const WaitListing = () => {
  const { t } = useTranslation()

  const goToLogin = e => {
    e.preventDefault()
    getLoginURL(window.location.href).then(url => { window.location.href = url })
  }

  const goToRegister = e => {
    e.preventDefault()
    getRegisterURL().then(url => { window.location.href = url })
  }

  return (
    <Box
      sx={{
        minHeight: { xs: 'auto', sm: 'calc(100dvh - 100px)' },
        display: 'flex',
        alignItems: { xs: 'stretch', sm: 'center' },
        justifyContent: 'center',
        px: 2,
        py: {xs: 3, sm: 0 },
        overflowY: 'auto',
        scrollBehavior: 'smooth',
      }}
    >
      <Container
        maxWidth="lg"
        disableGutters
        sx={{
          display: 'flex',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            mx: 'auto',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            p: { xs: 1, sm: 1, md: 1 },
            borderRadius: 4,
            textAlign: 'center',
            background: 'none',
            maxWidth: { xs: 720, md: 1100 },
          }}
        >
          <Box sx={{ mb: { xs: 3, sm: 4 } }}>
            <Box
              component="img"
              src="FullLogo-BlackText.png"
              alt="OCL"
              sx={{ width: { xs: 160, sm: 240, md: 300, lg: 380 }, height: 'auto' }}
            />
          </Box>
          <Typography
            variant="h1"
            sx={{
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'text.primary',
              fontSize: 'clamp(26px, 2.2vw, 56px)',
              maxWidth: 980,
              mx: 'auto',
              mb: { xs: 1.5, sm: 2 },
            }}
          >
            {t('map_project.preview_splash_headline')}
          </Typography>

          <Typography
            variant="h5"
            sx={{
              color: 'text.secondary',
              fontWeight: 400,
              fontSize: 'clamp(15px, 2.2vw, 22px)',
              maxWidth: 900,
              mx: 'auto',
              mb: { xs: 1.5, sm: 2 },
            }}
          >
            {t('map_project.preview_splash_subhead')}
          </Typography>

          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              maxWidth: 780,
              mx: 'auto',
              mb: { xs: 3, sm: 3 },
            }}
          >
            {t('map_project.preview_splash_footnote')}
          </Typography>

          <Box
            sx={{
              width: '100%',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 2,
              mb: { xs: 2, sm: 3, md: 3, lg: 3 },
            }}
          >
            <Button
              size="large"
              variant="contained"
              color="primary"
              onClick={goToLogin}
              sx={{
                px: { xs: 3.5, sm: 4.5 },
                py: { xs: 1.25, sm: 1.5 },
                borderRadius: 999,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: 'clamp(14px, 1.8vw, 18px)',
              }}
            >
              {t('map_project.preview_splash_sign_in_cta')}
            </Button>
            <Button
              size="large"
              variant="outlined"
              color="primary"
              onClick={goToRegister}
              sx={{
                px: { xs: 3.5, sm: 4.5 },
                py: { xs: 1.25, sm: 1.5 },
                borderRadius: 999,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: 'clamp(14px, 1.8vw, 18px)',
              }}
            >
              {t('map_project.preview_splash_register_cta')}
            </Button>
          </Box>
          <Box
            component="img"
            src="mapper_landing_placeholder.png"
            alt="OCL Mapper preview"
            loading="lazy"
            sx={{
              display: 'block',
              mx: 'auto',
              width: '100%',
              maxWidth: { xs: 350, sm: 400, md: 500, lg: 590 },
              maxHeight: { xs: '44vh', sm: '60vh', md: '65vh' },
              height: 'auto',
              objectFit: 'contain',
              borderRadius: 3,
              boxShadow: { xs: 'none', md: '0 10px 35px rgba(0,0,0,0.14)' },
            }}
          />
        </Paper>
      </Container>
    </Box>
  );
};


export default WaitListing;
