# Brexit Voting Intention: Ward-Level MRP Estimates

This repository contains the code to produce MRP estimates of **Rejoin the EU** versus **Stay out of the EU** voting intention in all **7,993 2022 census wards in Great Britain**. Northern Ireland is not included.

## About the estimates

I use **multilevel regression and poststratification (MRP)** to combine Wave 31 of the British Election Study Internet Panel with census data from England and Wales (2021) and Scotland (2022).

The process has two steps:

1. **Model voting intention.** First, I predict each respondent's Brexit voting intention based on their age group, sex, ethnicity, religion, education, housing tenure, socio-economic class (NS-SEC), and economic activity, plus the 2024 election results and estimated 2016 Leave share in their constituency and information on their ward, constituency, and government office region. The model includes Rejoin, Stay out, and a combined don't know / would not vote category.
2. **Weight to local populations.** Next, I weight predictions to match each ward's census demographic profile. For wards that cross constituency boundaries, I split population using census-adult overlap weights and recombine expected counts within each posterior draw. I then calculate Rejoin and Stay out shares, excluding don't knows and non-voters.

The 2024 constituency results and estimated 2016 Leave shares are contextual predictors. Leave shares use 2024 constituency boundaries and enter both training and prediction as raw proportions from 0 to 1. Remain shares are omitted because they equal one minus Leave. The Brexit estimates are not calibrated to election results.

## Running the scripts

Run `_scripts/000_run_all.R` from the project root. The prediction stage saves all three response categories in `_data/proc/ward_brexit_draws.rds`. The summary stage writes `_data/proc/ward_brexit_preds.rds` and `_output/ward_brexit_results.csv`, and the plotting stage writes `_output/ward_brexit_map.png`.

Set `refresh_predictions <- FALSE` to reuse existing Brexit summaries when plotting. The scripts do not read the previous general-election prediction files.


## What's in the CSV?

Each row represents a Brexit preference in a given ward. Shares are proportions from 0 to 1 and sum to one across Rejoin and Stay out within each ward.

| Column | Description |
| :--- | :--- |
| `ward`, `ward_name` | ONS ward code and ward name. |
| `pcon`, `pcon_name` | Constituency code and name for the largest census-adult population overlap. |
| `region` | Government office region. |
| `response` | `rejoin` (Rejoin the EU) or `out` (Stay out of the EU). |
| `est` | Mean expected count for the response divided by the mean total for Rejoin and Stay out. |
| `lci`, `uci` | Lower and upper bounds of the 95% interval from posterior draw-level shares. |
| `votes` | Mean expected count for the response in the ward. |
| `voters` | Mean total expected count for Rejoin and Stay out, repeated across both responses. |

Expected counts use census adult populations; they are not observed votes or counts of registered electors.
