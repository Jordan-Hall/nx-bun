import { BundleExecutorSchema } from './schema';
import executor from './executor';

const options: BundleExecutorSchema = {};

describe('Bundle Executor', () => {
  it('can run', async () => {
    const output = await executor(options);
    expect(output.success).toBe(true);
  });
});
