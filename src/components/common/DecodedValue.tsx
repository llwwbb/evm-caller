import React from 'react';
import { DisplayValue } from '../../utils/decodedFormat';
import { AddressNameLookup } from '../../utils/addressDisplay';
import AddressBadge from './AddressBadge';

interface Props {
  value: DisplayValue;
  lookup: AddressNameLookup;
  showNames: boolean;
  variant?: 'block' | 'compact';
  depth?: number;
}

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

const DecodedValue: React.FC<Props> = ({
  value,
  lookup,
  showNames,
  variant = 'block',
  depth = 0,
}) => {
  if (value == null) return <span className="text-fg-dim">null</span>;

  if (typeof value === 'string') {
    if (ADDR_RE.test(value)) {
      return <AddressBadge addr={value} lookup={lookup} showNames={showNames} />;
    }
    return <span className="font-mono text-fg break-all">{value}</span>;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return <span className="font-mono text-fg">{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (variant === 'compact') {
      return (
        <span className="font-mono text-fg">
          [
          {value.map((v, i) => (
            <React.Fragment key={i}>
              {i > 0 && ', '}
              <DecodedValue
                value={v}
                lookup={lookup}
                showNames={showNames}
                variant="compact"
                depth={depth + 1}
              />
            </React.Fragment>
          ))}
          ]
        </span>
      );
    }
    return (
      <div className="font-mono">
        {value.length === 0 ? (
          <span className="text-fg-dim">[]</span>
        ) : (
          value.map((v, i) => (
            <div key={i} className="flex gap-1.5">
              <span className="text-fg-mute">{i}:</span>
              <div className="flex-1 min-w-0">
                <DecodedValue
                  value={v}
                  lookup={lookup}
                  showNames={showNames}
                  depth={depth + 1}
                />
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  // object
  const keys = Object.keys(value);
  if (variant === 'compact') {
    return (
      <span className="font-mono text-fg">
        {'{'}
        {keys.map((k, i) => (
          <React.Fragment key={k}>
            {i > 0 && ', '}
            <span className="text-fg-dim">{k}:</span>{' '}
            <DecodedValue
              value={(value as any)[k]}
              lookup={lookup}
              showNames={showNames}
              variant="compact"
              depth={depth + 1}
            />
          </React.Fragment>
        ))}
        {'}'}
      </span>
    );
  }
  return (
    <div className="font-mono">
      {keys.length === 0 ? (
        <span className="text-fg-dim">{'{}'}</span>
      ) : (
        keys.map((k) => (
          <div key={k} className="flex gap-1.5">
            <span className="text-fg-dim">{k}:</span>
            <div className="flex-1 min-w-0">
              <DecodedValue
                value={(value as any)[k]}
                lookup={lookup}
                showNames={showNames}
                depth={depth + 1}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default DecodedValue;
