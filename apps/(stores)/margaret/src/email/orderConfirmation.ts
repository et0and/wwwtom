import { formatNZD } from "../lib/formatNZD";

interface OrderConfirmationData {
  orderNumber: string;
  productName: string;
  quantity: number;
  amountPaid: number;
  shippingAddress: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    postalCode: string;
    country: string;
  };
}

export const renderOrderConfirmationEmail = (
  data: OrderConfirmationData,
): { subject: string; html: string } => {
  const { orderNumber, productName, quantity, amountPaid, shippingAddress } = data;

  const subject = `Order Confirmed — ${orderNumber}`;

  const addressLines = [
    shippingAddress.name,
    shippingAddress.line1,
    shippingAddress.line2,
    `${shippingAddress.city} ${shippingAddress.postalCode}`,
    shippingAddress.country,
  ]
    .filter(Boolean)
    .join("<br>");

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9f7f4;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f7f4;padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:40px;">
<tr><td>
<h1 style="margin:0 0 24px;font-size:22px;color:#2d2a26;">Order Confirmed</h1>
<p style="margin:0 0 8px;font-size:14px;color:#6b6560;">Order number</p>
<p style="margin:0 0 24px;font-size:16px;color:#2d2a26;font-weight:bold;">${orderNumber}</p>
<table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e8e4e0;border-bottom:1px solid #e8e4e0;padding:16px 0;margin:0 0 24px;">
<tr>
<td style="padding:8px 0;font-size:14px;color:#2d2a26;">${productName} × ${quantity}</td>
<td align="right" style="padding:8px 0;font-size:14px;color:#2d2a26;font-weight:bold;">${formatNZD(amountPaid)}</td>
</tr>
</table>
<p style="margin:0 0 8px;font-size:14px;color:#6b6560;">Shipping to</p>
<p style="margin:0 0 24px;font-size:14px;color:#2d2a26;line-height:1.6;">${addressLines}</p>
<p style="margin:0 0 24px;font-size:14px;color:#6b6560;">Estimated delivery: 5–10 business days.</p>
<p style="margin:0 0 4px;font-size:14px;color:#2d2a26;">With love,</p>
<p style="margin:0 0 24px;font-size:14px;color:#2d2a26;font-style:italic;">Grandma Hope</p>
<p style="margin:0;font-size:12px;color:#a09890;">Questions? Contact us at noreply@office.yufugumi.com</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, html };
};
