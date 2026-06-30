import React from 'react';
import Button from '@mui/material/Button'
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';

const WaitListing = ({ onSignup }) => {
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
            The future of terminology mapping is coming soon!
          </Typography>

          <Typography
            variant="h5"
            sx={{
              color: 'text.secondary',
              fontWeight: 400,
              fontSize: 'clamp(15px, 2.2vw, 22px)',
              maxWidth: 900,
              mx: 'auto',
              mb: { xs: 3, sm: 3 },
            }}
          >
            Join the waitlist for early access to the OCL Mapper on OCL Online.
          </Typography>

          <Box
            sx={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              mb: { xs: 2, sm: 3, md: 3, lg: 3 },
            }}
          >
            <Button
              href='https://docs.google.com/forms/d/e/1FAIpQLSed7ftI_eUt5fp-YQZM7z1YHRg5-7qz69gVImy2SlX4-73kOg/viewform'
              size="large"
              variant="contained"
              color="primary"
              onClick={onSignup}
              sx={{
                px: { xs: 3.5, sm: 4.5 },
                py: { xs: 1.25, sm: 1.5 },
                borderRadius: 999,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: 'clamp(14px, 1.8vw, 18px)',
              }}
            >
              Sign up for Early Access
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
