args <- commandArgs(trailingOnly = TRUE)
stopifnot(length(args) == 2)
suppressPackageStartupMessages(library(sf))
suppressPackageStartupMessages(library(dplyr))

# Match the census exceptions used by the published ward MRP estimates.
wards <- st_read(args[1], quiet = TRUE) |>
  st_transform(27700) |>
  filter(substr(WD22CD, 1, 1) != "N") |>
  mutate(ward = case_when(
    LAD22CD %in% c("E09000001", "E06000053") ~ LAD22CD,
    WD22NM == "Hunmanby & Sherburn (part Ryedale)" ~ "E05R14284",
    WD22NM == "Hunmanby & Sherburn (part Scarborough)" ~ "E05S14284",
    TRUE ~ WD22CD
  )) |>
  select(ward) |>
  st_make_valid() |>
  group_by(ward) |>
  summarise(.groups = "drop")
stopifnot(!anyDuplicated(wards$ward), !any(st_is_empty(wards)), all(st_is_valid(wards)))
st_write(wards, args[2], quiet = TRUE)
