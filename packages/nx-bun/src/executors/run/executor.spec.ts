import { RunExecutorSchema } from './schema';
import executor from './executor';

const options: RunExecutorSchema = {};

describe('Run Executor', () => {
  it('can run', async () => {
    const output = await executor(options);
    expect(output.success).toBe(true);
  });
});
