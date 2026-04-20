import { render } from "@react-email/render";
import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export type VerificationEmailInput = {
  verificationUrl: string;
  recipientName?: string;
};

export type ForgotPasswordEmailInput = {
  resetUrl: string;
  recipientName?: string;
};

export type RenderedEmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

const baseStyles = {
  body: {
    backgroundColor: "#f6f2e8",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    margin: "0",
    padding: "24px",
  },
  container: {
    backgroundColor: "#ffffff",
    border: "1px solid #ece4d6",
    borderRadius: "8px",
    margin: "0 auto",
    maxWidth: "560px",
    padding: "24px",
  },
  text: {
    color: "#2d2418",
    fontSize: "16px",
    lineHeight: "24px",
    margin: "0 0 16px",
  },
  button: {
    backgroundColor: "#8c4f2b",
    borderRadius: "6px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "16px",
    fontWeight: "600",
    padding: "12px 18px",
    textDecoration: "none",
  },
  footer: {
    color: "#7f6f5b",
    fontSize: "14px",
    lineHeight: "20px",
    marginTop: "16px",
  },
} as const;

const makeGreeting = (recipientName?: string) => {
  if (!recipientName) return "Hello,";
  return `Hello ${recipientName},`;
};

const VerificationEmailTemplate = (props: VerificationEmailInput) => {
  const greeting = makeGreeting(props.recipientName);

  return (
    <Html>
      <Head />
      <Preview>Verify your Grandma Hope account</Preview>
      <Body style={baseStyles.body}>
        <Container style={baseStyles.container}>
          <Text style={baseStyles.text}>{greeting}</Text>
          <Text style={baseStyles.text}>
            Thanks for signing up to Grandma Hope. Please verify your email address to finish
            setting up your account.
          </Text>
          <Section>
            <Button href={props.verificationUrl} style={baseStyles.button}>
              Verify email address
            </Button>
          </Section>
          <Text style={baseStyles.footer}>
            If you did not create this account, you can ignore this message.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

const ForgotPasswordEmailTemplate = (props: ForgotPasswordEmailInput) => {
  const greeting = makeGreeting(props.recipientName);

  return (
    <Html>
      <Head />
      <Preview>Reset your Grandma Hope password</Preview>
      <Body style={baseStyles.body}>
        <Container style={baseStyles.container}>
          <Text style={baseStyles.text}>{greeting}</Text>
          <Text style={baseStyles.text}>
            We received a request to reset your Grandma Hope password.
          </Text>
          <Section>
            <Button href={props.resetUrl} style={baseStyles.button}>
              Reset password
            </Button>
          </Section>
          <Text style={baseStyles.footer}>
            If you did not request a password reset, no further action is required.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export const renderVerificationEmail = async (
  input: VerificationEmailInput,
): Promise<RenderedEmailTemplate> => {
  const subject = "Verify your Grandma Hope account";
  const html = await render(<VerificationEmailTemplate {...input} />);
  const text = await render(<VerificationEmailTemplate {...input} />, {
    plainText: true,
  });

  return {
    subject,
    html,
    text,
  };
};

export const renderForgotPasswordEmail = async (
  input: ForgotPasswordEmailInput,
): Promise<RenderedEmailTemplate> => {
  const subject = "Reset your Grandma Hope password";
  const html = await render(<ForgotPasswordEmailTemplate {...input} />);
  const text = await render(<ForgotPasswordEmailTemplate {...input} />, {
    plainText: true,
  });

  return {
    subject,
    html,
    text,
  };
};
