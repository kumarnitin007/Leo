export default function handler(_req: any, res: any) {
  try {
    const { createErrorResponse } = require('./_utils/errorHandler');
    res.status(200).json({ ok: true, test: createErrorResponse('SERVER_ERROR') });
  } catch (err: any) {
    res.status(200).json({ ok: false, error: err.message, stack: err.stack?.split('\n').slice(0, 5) });
  }
}
