import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FireworksPayloadPanel } from '@/components/FireworksPayloadPanel';
import { makeJob } from './fixtures';

describe('FireworksPayloadPanel', () => {
  it('renders heading and core field labels', () => {
    render(<FireworksPayloadPanel job={makeJob()} />);
    expect(screen.getByText('Fireworks payload')).toBeTruthy();
    expect(screen.getByText('Kind')).toBeTruthy();
    expect(screen.getByText('GPU count')).toBeTruthy();
    expect(screen.getByText('Fireworks job name')).toBeTruthy();
    expect(screen.getByText('Model')).toBeTruthy();
    expect(screen.getByText('Dataset')).toBeTruthy();
    expect(screen.getByText('Output model')).toBeTruthy();
  });

  it('prefers enriched columns over payload fields', () => {
    const job = makeJob({
      base_model: 'enriched-model',
      dataset: 'enriched-ds',
      output_model: 'enriched-out',
      fireworks_payload: { model: 'payload-model', dataset: 'payload-ds' },
    });
    render(<FireworksPayloadPanel job={job} />);
    expect(screen.getByText('enriched-model')).toBeTruthy();
    expect(screen.getByText('enriched-ds')).toBeTruthy();
    expect(screen.getByText('enriched-out')).toBeTruthy();
  });

  it('falls back to payload.model when base_model is missing', () => {
    const job = makeJob({
      base_model: null,
      dataset: null,
      output_model: null,
      fireworks_payload: { model: 'payload-model', dataset: 'payload-ds' },
    });
    render(<FireworksPayloadPanel job={job} />);
    expect(screen.getByText('payload-model')).toBeTruthy();
    expect(screen.getByText('payload-ds')).toBeTruthy();
  });

  it('falls back to payload.base_model when model is absent', () => {
    const job = makeJob({
      base_model: null,
      fireworks_payload: { base_model: 'alt-model' },
    });
    render(<FireworksPayloadPanel job={job} />);
    expect(screen.getByText('alt-model')).toBeTruthy();
  });

  it('renders em dash for missing values', () => {
    const job = makeJob({
      base_model: null,
      dataset: null,
      output_model: null,
      fireworks_job_name: null,
      fireworks_payload: null,
    });
    const { container } = render(<FireworksPayloadPanel job={job} />);
    // Multiple "—" placeholders should be present
    const dashes = container.querySelectorAll('.text-gray-400');
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it('ignores non-string payload values', () => {
    const job = makeJob({
      base_model: null,
      dataset: null,
      output_model: null,
      // numeric values should be treated as null by getString
      fireworks_payload: { model: 42 as unknown as string, dataset: { nested: true } as unknown as string },
    });
    const { container } = render(<FireworksPayloadPanel job={job} />);
    // Model and dataset both fall to em dash
    expect(container.textContent).toContain('—');
  });
});
