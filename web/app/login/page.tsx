"use client";

import { Card, CardContent, Button, Typography, Box } from "@mui/material";
import { signIn } from "next-auth/react";
import { FaGoogle } from "react-icons/fa";
import { useState } from "react";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn("google", {
        callbackUrl: "/",
        redirect: true,
      });
    } catch (error) {
      console.error("Sign in error:", error);
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
      }}
      className="bg-zinc-50 dark:bg-zinc-900"
    >
      <Card
        sx={{
          width: "100%",
          maxWidth: 450,
          boxShadow: 6,
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: "center", mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
              Welcome Back
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Sign in to continue to your logging dashboard
            </Typography>
          </Box>

          <Button
            variant="outlined"
            fullWidth
            size="large"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            startIcon={<FaGoogle />}
            sx={{
              py: 1.5,
              textTransform: "none",
              fontSize: "1rem",
              fontWeight: 600,
            }}
          >
            {isLoading ? "Signing in..." : "Continue with Google"}
          </Button>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", textAlign: "center", mt: 3 }}
          >
            By signing in, you agree to our{" "}
            <a href="/terms" className="text-zinc-900 dark:text-white hover:underline">
              terms of service
            </a>{" "}
            and{" "}
            <a href="/privacy" className="text-zinc-900 dark:text-white hover:underline">
              privacy policy
            </a>.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
