args <- commandArgs(trailingOnly = TRUE)
suppressPackageStartupMessages(library(sf))
sf_use_s2(FALSE)
wards <- st_read(args[1], quiet = TRUE)
stopifnot(nrow(wards) == 7993, !anyDuplicated(wards$ward),
          !any(st_is_empty(wards)), all(st_is_valid(wards)))
message("Verified all 7,993 final browser geometries: unique, nonempty and valid.")
