import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const app = new Hono();

const openai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
});

app.post('/', async (c) => {
  const body: any = await c.req.json();
  const image = body.base64 as string;

  const completion = await openai.chat.completions.create({
    model: 'grok-2-vision-latest',
    messages: [
      {
        role: 'system',
        content: `你是一个专业的移动支付截图解析助手。我会上传手机支付的截图，你需要从截图中提取关键信息并将其转换为标准JSON格式用于自动记账。
  
  请按照以下步骤处理：
  
  1. 仔细分析图片中的所有文字内容，特别关注付款金额、交易时间、商户名称等关键信息。
  2. 根据商户名称或交易描述，判断这笔支出应归类为哪一类（如：餐饮、交通、购物、娱乐等）。
  3. 将提取的信息整理成以下JSON格式：
  
  {
    "amount": 数字, // 交易金额，只需数字，不含货币符号
    "class": "类别", // 支出类别，如"餐饮"、"交通"、"购物"等
    "date": "YYYY-MM-DD HH:MM:SS", // 交易时间，标准格式
    "event": "事件名称" // 事件名称
  }
  
  如果某项信息在截图中无法找到，请在相应字段填入null。对于"class"字段，请根据商户名称做出最合理的判断。
  
  返回的JSON必须是有效的、可解析的格式，不要包含注释。`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${body.base64}`,
              detail: 'high',
            },
          },
        ],
      },
    ],
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0].message.content

  if (content) {
    const res = JSON.parse(content);
    try {
      await fetch(process.env.FEISHU_WEBHOOK_URL!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(res),
      });
      return c.json({
        message: '解析成功',
      });
    } catch (error) {
      console.error(error);
      return c.json({
        message: '解析失败',
      });
    }

    return c.json(res);
  }

  return c.json({
    message: '解析失败',
  });
});

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);
