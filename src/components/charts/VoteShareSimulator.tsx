import { useState } from "react";

type Props = {
  labourBase?: number;
  conservativeBase?: number;
  reformBase?: number;
  libDemBase?: number;
  greenBase?: number;
};

export default function VoteShareSimulator({
  labourBase = 31,
  conservativeBase = 24,
  reformBase = 18,
  libDemBase = 12,
  greenBase = 8
}: Props) {
  const [swing, setSwing] = useState(0);

  const labour = labourBase + swing;
  const conservative = conservativeBase - swing;
  const parties = [
    { label: "Labour", value: labour, color: "#F76F5C" },
    { label: "Conservative", value: conservative, color: "#1d4ed8" },
    { label: "Reform UK", value: reformBase, color: "#9333ea" },
    { label: "Liberal Democrats", value: libDemBase, color: "#f59e0b" },
    { label: "Green", value: greenBase, color: "#16a34a" }
  ];

  const maxValue = Math.max(...parties.map((party) => party.value), 35);
  const lead = labour - conservative;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <label htmlFor="swing" className="block text-sm font-semibold text-[#111111]">
          Uniform swing between Labour and Conservative: {swing > 0 ? "+" : ""}
          {swing.toFixed(1)} points to Labour
        </label>
        <input
          id="swing"
          type="range"
          min="-5"
          max="5"
          step="0.5"
          value={swing}
          onChange={(event) => setSwing(Number(event.target.value))}
          className="w-full accent-[#F76F5C]"
        />
        <p className="text-sm leading-6 text-[#111111]">
          This is a simple explainer. It is not a forecast. It shows how a modest swing can change the headline even when other parties are stable.
        </p>
      </div>

      <div className="space-y-3">
        {parties.map((party) => (
          <div key={party.label} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-[#111111]">{party.label}</span>
              <span className="text-[#111111]">{party.value.toFixed(1)}%</span>
            </div>
            <div className="h-3 rounded-full bg-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
              <div
                className="h-3 rounded-full"
                style={{
                  width: `${(party.value / maxValue) * 100}%`,
                  backgroundColor: party.color
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-[1.25rem] border border-white/55 bg-white/38 p-4 text-sm text-[#111111] backdrop-blur-xl">
        Labour lead over Conservative:{" "}
        <span className="font-semibold text-[#111111]">
          {lead > 0 ? "+" : ""}
          {lead.toFixed(1)} points
        </span>
      </div>
    </div>
  );
}
