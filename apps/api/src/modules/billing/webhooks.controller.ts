import {
  Controller,
  Post,
  Req,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { PaymentGatewayProvider } from '@yogaos/database';
import { GatewaysService } from './gateways.service.js';

@Controller('billing/webhooks')
export class WebhooksController {
  constructor(private readonly gatewaysService: GatewaysService) {}

  @Post('razorpay')
  async handleRazorpayWebhook(
    @Req() req: any,
    @Headers('x-razorpay-signature') signature: string,
    @Headers('x-tenant-id') tenantIdHeader?: string
  ) {
    if (!signature) {
      throw new BadRequestException('Missing X-Razorpay-Signature header');
    }

    const rawBody =
      typeof req.rawBody === 'string'
        ? req.rawBody
        : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body);

    return this.gatewaysService.processWebhook(
      PaymentGatewayProvider.RAZORPAY,
      rawBody,
      signature,
      tenantIdHeader
    );
  }

  @Post('stripe')
  async handleStripeWebhook(
    @Req() req: any,
    @Headers('stripe-signature') signature: string,
    @Headers('x-tenant-id') tenantIdHeader?: string
  ) {
    if (!signature) {
      throw new BadRequestException('Missing Stripe-Signature header');
    }

    const rawBody =
      typeof req.rawBody === 'string'
        ? req.rawBody
        : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body);

    return this.gatewaysService.processWebhook(
      PaymentGatewayProvider.STRIPE,
      rawBody,
      signature,
      tenantIdHeader
    );
  }
}
