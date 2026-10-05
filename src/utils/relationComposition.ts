export const COMPREHENSIVE_COMPOSITION_TABLE: Array<{ my: string; their: string; result: string }> = [
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. FATHER (VADIL)
  // ─────────────────────────────────────────────────────────────────────────────
  { my: 'VADIL', their: 'VADIL', result: 'AJOBA' },
  { my: 'VADIL', their: 'AAI', result: 'AAJI' },
  { my: 'VADIL', their: 'BHAU', result: 'KAKA' },
  { my: 'VADIL', their: 'BAHIN', result: 'AATYA' },
  { my: 'VADIL', their: 'BAYKO', result: 'AAI' },
  { my: 'VADIL', their: 'MULGA', result: 'BHAU' },
  { my: 'VADIL', their: 'MULGI', result: 'BAHIN' },
  { my: 'VADIL', their: 'AJOBA', result: 'PANJOBA' },
  { my: 'VADIL', their: 'AAJI', result: 'PANAAJI' },
  { my: 'VADIL', their: 'KAKA', result: 'CHULAT_AJOBA' },
  { my: 'VADIL', their: 'KAKI', result: 'CHULAT_AAJI' },
  { my: 'VADIL', their: 'AATYA', result: 'AATYA_AAJI' },
  { my: 'VADIL', their: 'FUA', result: 'FUA_AJOBA' },
  { my: 'VADIL', their: 'CHULAT_BHAU', result: 'CHULAT_KAKA' },
  { my: 'VADIL', their: 'CHULAT_BAHIN', result: 'CHULAT_AATYA' },

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. MOTHER (AAI)
  // ─────────────────────────────────────────────────────────────────────────────
  { my: 'AAI', their: 'VADIL', result: 'NANA' },
  { my: 'AAI', their: 'AAI', result: 'NANI' },
  { my: 'AAI', their: 'BHAU', result: 'MAMA' },
  { my: 'AAI', their: 'BAHIN', result: 'MAVSHI' },
  { my: 'AAI', their: 'NAVRA', result: 'VADIL' },
  { my: 'AAI', their: 'MULGA', result: 'BHAU' },
  { my: 'AAI', their: 'MULGI', result: 'BAHIN' },
  { my: 'AAI', their: 'AJOBA', result: 'NANA_PANJOBA' },
  { my: 'AAI', their: 'AAJI', result: 'NANI_PANJI' },
  { my: 'AAI', their: 'KAKA', result: 'CHULAT_MAMA' },
  { my: 'AAI', their: 'MAVSHI', result: 'CHULAT_MAVSHI' },

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. PATERNAL UNCLE (KAKA / CHULTA)
  // ─────────────────────────────────────────────────────────────────────────────
  { my: 'KAKA', their: 'MULGA', result: 'CHULAT_BHAU' },
  { my: 'KAKA', their: 'MULGI', result: 'CHULAT_BAHIN' },
  { my: 'KAKA', their: 'BAYKO', result: 'KAKI' },
  { my: 'KAKA', their: 'VADIL', result: 'AJOBA' },
  { my: 'KAKA', their: 'AAI', result: 'AAJI' },
  { my: 'KAKA', their: 'BHAU', result: 'KAKA' },
  { my: 'KAKA', their: 'BAHIN', result: 'AATYA' },
  { my: 'CHULTA', their: 'MULGA', result: 'CHULAT_BHAU' },
  { my: 'CHULTA', their: 'MULGI', result: 'CHULAT_BAHIN' },
  { my: 'CHULTA', their: 'BAYKO', result: 'KAKI' },

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. PATERNAL AUNT-IN-LAW (KAKI / CHULTI)
  // ─────────────────────────────────────────────────────────────────────────────
  { my: 'KAKI', their: 'MULGA', result: 'CHULAT_BHAU' },
  { my: 'KAKI', their: 'MULGI', result: 'CHULAT_BAHIN' },
  { my: 'KAKI', their: 'NAVRA', result: 'KAKA' },
  { my: 'CHULTI', their: 'MULGA', result: 'CHULAT_BHAU' },
  { my: 'CHULTI', their: 'MULGI', result: 'CHULAT_BAHIN' },
  { my: 'CHULTI', their: 'NAVRA', result: 'KAKA' },

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. PATERNAL AUNT (AATYA)
  // ─────────────────────────────────────────────────────────────────────────────
  { my: 'AATYA', their: 'MULGA', result: 'ATYE_BHAU' },
  { my: 'AATYA', their: 'MULGI', result: 'ATYE_BAHIN' },
  { my: 'AATYA', their: 'NAVRA', result: 'FUA' },
  { my: 'AATYA', their: 'VADIL', result: 'AJOBA' },
  { my: 'AATYA', their: 'AAI', result: 'AAJI' },
  { my: 'AATYA', their: 'BHAU', result: 'KAKA' },

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. PATERNAL AUNT'S HUSBAND (FUA)
  // ─────────────────────────────────────────────────────────────────────────────
  { my: 'FUA', their: 'MULGA', result: 'ATYE_BHAU' },
  { my: 'FUA', their: 'MULGI', result: 'ATYE_BAHIN' },
  { my: 'FUA', their: 'BAYKO', result: 'AATYA' },

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. MATERNAL UNCLE (MAMA)
  // ─────────────────────────────────────────────────────────────────────────────
  { my: 'MAMA', their: 'MULGA', result: 'MAMI_BHAU' },
  { my: 'MAMA', their: 'MULGI', result: 'MAMI_BAHIN' },
  { my: 'MAMA', their: 'BAYKO', result: 'MAMI' },
  { my: 'MAMA', their: 'VADIL', result: 'NANA' },
  { my: 'MAMA', their: 'AAI', result: 'NANI' },
  { my: 'MAMA', their: 'BHAU', result: 'MAMA' },
  { my: 'MAMA', their: 'BAHIN', result: 'MAVSHI' },

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. MATERNAL UNCLE'S WIFE (MAMI)
  // ─────────────────────────────────────────────────────────────────────────────
  { my: 'MAMI', their: 'MULGA', result: 'MAMI_BHAU' },
  { my: 'MAMI', their: 'MULGI', result: 'MAMI_BAHIN' },
  { my: 'MAMI', their: 'NAVRA', result: 'MAMA' },

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. MATERNAL AUNT (MAVSHI)
  // ─────────────────────────────────────────────────────────────────────────────
  { my: 'MAVSHI', their: 'MULGA', result: 'MAV_BHAU' },
  { my: 'MAVSHI', their: 'MULGI', result: 'MAV_BAHIN' },
  { my: 'MAVSHI', their: 'NAVRA', result: 'MAVSA' },
  { my: 'MAVSHI', their: 'VADIL', result: 'NANA' },
  { my: 'MAVSHI', their: 'AAI', result: 'NANI' },
  { my: 'MAVSHI', their: 'BHAU', result: 'MAMA' },
  { my: 'MAVSHI', their: 'BAHIN', result: 'MAVSHI' },

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. MATERNAL AUNT'S HUSBAND (MAVSA)
  // ─────────────────────────────────────────────────────────────────────────────
  { my: 'MAVSA', their: 'MULGA', result: 'MAV_BHAU' },
  { my: 'MAVSA', their: 'MULGI', result: 'MAV_BAHIN' },
  { my: 'MAVSA', their: 'BAYKO', result: 'MAVSHI' },

  // ─────────────────────────────────────────────────────────────────────────────
  // 11. BROTHER (BHAU)
  // ─────────────────────────────────────────────────────────────────────────────
  { my: 'BHAU', their: 'MULGA', result: 'PUTANYA' },
  { my: 'BHAU', their: 'MULGI', result: 'PUTANI' },
  { my: 'BHAU', their: 'BAYKO', result: 'VAHINI' },
  { my: 'BHAU', their: 'VADIL', result: 'VADIL' },
  { my: 'BHAU', their: 'AAI', result: 'AAI' },
  { my: 'BHAU', their: 'BHAU', result: 'BHAU' },
  { my: 'BHAU', their: 'BAHIN', result: 'BAHIN' },
  { my: 'BHAU', their: 'NATU', result: 'NATU' },
  { my: 'BHAU', their: 'NAAT', result: 'NAAT' },

  // ─────────────────────────────────────────────────────────────────────────────
  // 12. SISTER (BAHIN)
  // ─────────────────────────────────────────────────────────────────────────────
  { my: 'BAHIN', their: 'MULGA', result: 'BHACHA' },
  { my: 'BAHIN', their: 'MULGI', result: 'BHACHI' },
  { my: 'BAHIN', their: 'NAVRA', result: 'DAJI' },
  { my: 'BAHIN', their: 'VADIL', result: 'VADIL' },
  { my: 'BAHIN', their: 'AAI', result: 'AAI' },
  { my: 'BAHIN', their: 'BHAU', result: 'BHAU' },
  { my: 'BAHIN', their: 'BAHIN', result: 'BAHIN' },

  // ─────────────────────────────────────────────────────────────────────────────
  // 13. SISTER-IN-LAW (VAHINI)
  // ─────────────────────────────────────────────────────────────────────────────
  { my: 'VAHINI', their: 'NAVRA', result: 'BHAU' },
  { my: 'VAHINI', their: 'MULGA', result: 'PUTANYA' },
  { my: 'VAHINI', their: 'MULGI', result: 'PUTANI' },

  // ─────────────────────────────────────────────────────────────────────────────
  // 14. BROTHER-IN-LAW (DAJI)
  // ─────────────────────────────────────────────────────────────────────────────
  { my: 'DAJI', their: 'BAYKO', result: 'BAHIN' },
  { my: 'DAJI', their: 'MULGA', result: 'BHACHA' },
  { my: 'DAJI', their: 'MULGI', result: 'BHACHI' },

  // ─────────────────────────────────────────────────────────────────────────────
  // 15. COUSINS (CHULAT / ATYE / MAMI / MAV BHAU & BAHIN)
  // ─────────────────────────────────────────────────────────────────────────────
  { my: 'CHULAT_BHAU', their: 'MULGA', result: 'CHULAT_PUTANYA' },
  { my: 'CHULAT_BHAU', their: 'MULGI', result: 'CHULAT_PUTANI' },
  { my: 'CHULAT_BHAU', their: 'BAYKO', result: 'CHULAT_VAHINI' },
  { my: 'CHULAT_BHAU', their: 'VADIL', result: 'KAKA' },
  { my: 'CHULAT_BHAU', their: 'AAI', result: 'KAKI' },
  { my: 'CHULAT_BHAU', their: 'BHAU', result: 'CHULAT_BHAU' },
  { my: 'CHULAT_BHAU', their: 'BAHIN', result: 'CHULAT_BAHIN' },

  { my: 'CHULAT_BAHIN', their: 'MULGA', result: 'CHULAT_BHACHA' },
  { my: 'CHULAT_BAHIN', their: 'MULGI', result: 'CHULAT_BHACHI' },
  { my: 'CHULAT_BAHIN', their: 'NAVRA', result: 'CHULAT_DAJI' },
  { my: 'CHULAT_BAHIN', their: 'VADIL', result: 'KAKA' },
  { my: 'CHULAT_BAHIN', their: 'AAI', result: 'KAKI' },
  { my: 'CHULAT_BAHIN', their: 'BHAU', result: 'CHULAT_BHAU' },
  { my: 'CHULAT_BAHIN', their: 'BAHIN', result: 'CHULAT_BAHIN' },

  { my: 'ATYE_BHAU', their: 'VADIL', result: 'FUA' },
  { my: 'ATYE_BHAU', their: 'AAI', result: 'AATYA' },
  { my: 'ATYE_BHAU', their: 'BHAU', result: 'ATYE_BHAU' },
  { my: 'ATYE_BHAU', their: 'BAHIN', result: 'ATYE_BAHIN' },

  { my: 'ATYE_BAHIN', their: 'VADIL', result: 'FUA' },
  { my: 'ATYE_BAHIN', their: 'AAI', result: 'AATYA' },
  { my: 'ATYE_BAHIN', their: 'BHAU', result: 'ATYE_BHAU' },
  { my: 'ATYE_BAHIN', their: 'BAHIN', result: 'ATYE_BAHIN' },

  { my: 'MAMI_BHAU', their: 'VADIL', result: 'MAMA' },
  { my: 'MAMI_BHAU', their: 'AAI', result: 'MAMI' },
  { my: 'MAMI_BHAU', their: 'BHAU', result: 'MAMI_BHAU' },
  { my: 'MAMI_BHAU', their: 'BAHIN', result: 'MAMI_BAHIN' },
  { my: 'MAMBHAU', their: 'VADIL', result: 'MAMA' },
  { my: 'MAMBHAU', their: 'AAI', result: 'MAMI' },
  { my: 'MAMBHAU', their: 'BHAU', result: 'MAMI_BHAU' },
  { my: 'MAMBHAU', their: 'BAHIN', result: 'MAMI_BAHIN' },

  { my: 'MAMI_BAHIN', their: 'VADIL', result: 'MAMA' },
  { my: 'MAMI_BAHIN', their: 'AAI', result: 'MAMI' },
  { my: 'MAMI_BAHIN', their: 'BHAU', result: 'MAMI_BHAU' },
  { my: 'MAMI_BAHIN', their: 'BAHIN', result: 'MAMI_BAHIN' },
  { my: 'MAMBAHIN', their: 'VADIL', result: 'MAMA' },
  { my: 'MAMBAHIN', their: 'AAI', result: 'MAMI' },
  { my: 'MAMBAHIN', their: 'BHAU', result: 'MAMI_BHAU' },
  { my: 'MAMBAHIN', their: 'BAHIN', result: 'MAMI_BAHIN' },

  { my: 'MAV_BHAU', their: 'VADIL', result: 'MAVSA' },
  { my: 'MAV_BHAU', their: 'AAI', result: 'MAVSHI' },
  { my: 'MAV_BHAU', their: 'BHAU', result: 'MAV_BHAU' },
  { my: 'MAV_BHAU', their: 'BAHIN', result: 'MAV_BAHIN' },

  { my: 'MAV_BAHIN', their: 'VADIL', result: 'MAVSA' },
  { my: 'MAV_BAHIN', their: 'AAI', result: 'MAVSHI' },
  { my: 'MAV_BAHIN', their: 'BHAU', result: 'MAV_BHAU' },
  { my: 'MAV_BAHIN', their: 'BAHIN', result: 'MAV_BAHIN' },

  // ─────────────────────────────────────────────────────────────────────────────
  // 16. PATERNAL GRANDPARENTS (AJOBA / AAJI)
  // ─────────────────────────────────────────────────────────────────────────────
  { my: 'AJOBA', their: 'BAYKO', result: 'AAJI' },
  { my: 'AJOBA', their: 'VADIL', result: 'PANJOBA' },
  { my: 'AJOBA', their: 'AAI', result: 'PANAAJI' },
  { my: 'AJOBA', their: 'MULGA', result: 'KAKA' },
  { my: 'AJOBA', their: 'MULGI', result: 'AATYA' },
  { my: 'AJOBA', their: 'BHAU', result: 'CHULAT_AJOBA' },
  { my: 'AJOBA', their: 'BAHIN', result: 'AATYA_AAJI' },

  { my: 'AAJI', their: 'NAVRA', result: 'AJOBA' },
  { my: 'AAJI', their: 'VADIL', result: 'PANJOBA' },
  { my: 'AAJI', their: 'AAI', result: 'PANAAJI' },
  { my: 'AAJI', their: 'MULGA', result: 'KAKA' },
  { my: 'AAJI', their: 'MULGI', result: 'AATYA' },

  // ─────────────────────────────────────────────────────────────────────────────
  // 17. MATERNAL GRANDPARENTS (NANA / NANI)
  // ─────────────────────────────────────────────────────────────────────────────
  { my: 'NANA', their: 'BAYKO', result: 'NANI' },
  { my: 'NANA', their: 'MULGA', result: 'MAMA' },
  { my: 'NANA', their: 'MULGI', result: 'MAVSHI' },
  { my: 'NANA', their: 'VADIL', result: 'NANA_PANJOBA' },
  { my: 'NANA', their: 'AAI', result: 'NANI_PANJI' },

  { my: 'NANI', their: 'NAVRA', result: 'NANA' },
  { my: 'NANI', their: 'MULGA', result: 'MAMA' },
  { my: 'NANI', their: 'MULGI', result: 'MAVSHI' },

  // ─────────────────────────────────────────────────────────────────────────────
  // 18. CHILDREN (MULGA / MULGI)
  // ─────────────────────────────────────────────────────────────────────────────
  { my: 'MULGA', their: 'BAYKO', result: 'SUN' },
  { my: 'MULGA', their: 'MULGA', result: 'NATU' },
  { my: 'MULGA', their: 'MULGI', result: 'NAAT' },
  { my: 'MULGA', their: 'BHAU', result: 'MULGA' },
  { my: 'MULGA', their: 'BAHIN', result: 'MULGI' },

  { my: 'MULGI', their: 'NAVRA', result: 'JAVAI' },
  { my: 'MULGI', their: 'MULGA', result: 'NATU' },
  { my: 'MULGI', their: 'MULGI', result: 'NAAT' },
  { my: 'MULGI', their: 'BHAU', result: 'MULGA' },
  { my: 'MULGI', their: 'BAHIN', result: 'MULGI' },

  // ─────────────────────────────────────────────────────────────────────────────
  // 19. CHILDREN-IN-LAW (SUN / JAVAI)
  // ─────────────────────────────────────────────────────────────────────────────
  { my: 'SUN', their: 'NAVRA', result: 'MULGA' },
  { my: 'SUN', their: 'MULGA', result: 'NATU' },
  { my: 'SUN', their: 'MULGI', result: 'NAAT' },

  { my: 'JAVAI', their: 'BAYKO', result: 'MULGI' },
  { my: 'JAVAI', their: 'MULGA', result: 'NATU' },
  { my: 'JAVAI', their: 'MULGI', result: 'NAAT' },

  // ─────────────────────────────────────────────────────────────────────────────
  // 20. GRANDCHILDREN (NATU / NAAT)
  // ─────────────────────────────────────────────────────────────────────────────
  { my: 'NATU', their: 'BAYKO', result: 'NATASUN' },
  { my: 'NATU', their: 'MULGA', result: 'PANTU' },
  { my: 'NATU', their: 'MULGI', result: 'PANTI' },
  { my: 'NATU', their: 'BHAU', result: 'NATU' },
  { my: 'NATU', their: 'BAHIN', result: 'NAAT' },

  { my: 'NAAT', their: 'NAVRA', result: 'NAT_JAVAI' },
  { my: 'NAAT', their: 'MULGA', result: 'PANTU' },
  { my: 'NAAT', their: 'MULGI', result: 'PANTI' },
  { my: 'NAAT', their: 'BHAU', result: 'NATU' },
  { my: 'NAAT', their: 'BAHIN', result: 'NAAT' },

  // ─────────────────────────────────────────────────────────────────────────────
  // 21. NEPHEWS & NIECES (PUTANYA / PUTANI / BHACHA / BHACHI)
  // ─────────────────────────────────────────────────────────────────────────────
  { my: 'PUTANYA', their: 'BAYKO', result: 'CHULAT_SUN' },
  { my: 'PUTANYA', their: 'VADIL', result: 'BHAU' },
  { my: 'PUTANYA', their: 'AAI', result: 'VAHINI' },
  { my: 'PUTANYA', their: 'BHAU', result: 'PUTANYA' },
  { my: 'PUTANYA', their: 'BAHIN', result: 'PUTANI' },

  { my: 'PUTANI', their: 'NAVRA', result: 'JAVAI' },
  { my: 'PUTANI', their: 'VADIL', result: 'BHAU' },
  { my: 'PUTANI', their: 'AAI', result: 'VAHINI' },
  { my: 'PUTANI', their: 'BHAU', result: 'PUTANYA' },
  { my: 'PUTANI', their: 'BAHIN', result: 'PUTANI' },

  { my: 'BHACHA', their: 'BAYKO', result: 'BHACHI_SUN' },
  { my: 'BHACHA', their: 'VADIL', result: 'DAJI' },
  { my: 'BHACHA', their: 'AAI', result: 'BAHIN' },
  { my: 'BHACHA', their: 'BHAU', result: 'BHACHA' },
  { my: 'BHACHA', their: 'BAHIN', result: 'BHACHI' },

  { my: 'BHACHI', their: 'NAVRA', result: 'JAVAIBHACHA' },
  { my: 'BHACHI', their: 'VADIL', result: 'DAJI' },
  { my: 'BHACHI', their: 'AAI', result: 'BAHIN' },
  { my: 'BHACHI', their: 'BHAU', result: 'BHACHA' },
  { my: 'BHACHI', their: 'BAHIN', result: 'BHACHI' },

  // ─────────────────────────────────────────────────────────────────────────────
  // 22. SPOUSE & IN-LAWS (BAYKO / NAVRA / SASRA / SASU / MEVHANA / etc.)
  // ─────────────────────────────────────────────────────────────────────────────
  { my: 'BAYKO', their: 'VADIL', result: 'SASRA' },
  { my: 'BAYKO', their: 'AAI', result: 'SASU' },
  { my: 'BAYKO', their: 'BHAU', result: 'MEVHANA' },
  { my: 'BAYKO', their: 'BAHIN', result: 'MEVHANI' },
  { my: 'BAYKO', their: 'AJOBA', result: 'AJOBA_SASRA' },
  { my: 'BAYKO', their: 'AAJI', result: 'AJI_SASU' },
  { my: 'BAYKO', their: 'MAMA', result: 'MAMA_SASRA' },

  { my: 'NAVRA', their: 'VADIL', result: 'SASRA' },
  { my: 'NAVRA', their: 'AAI', result: 'SASU' },
  { my: 'NAVRA', their: 'BHAU', result: 'DIR_CHOTE' },
  { my: 'NAVRA', their: 'BAHIN', result: 'NANAND' },
  { my: 'NAVRA', their: 'AJOBA', result: 'AJOBA_SASRA' },
  { my: 'NAVRA', their: 'AAJI', result: 'AJI_SASU' },

  { my: 'SASRA', their: 'BAYKO', result: 'SASU' },
  { my: 'SASRA', their: 'MULGA', result: 'MEVHANA' },
  { my: 'SASRA', their: 'MULGI', result: 'MEVHANI' },

  { my: 'SASU', their: 'NAVRA', result: 'SASRA' },
  { my: 'SASU', their: 'MULGA', result: 'MEVHANA' },
  { my: 'SASU', their: 'MULGI', result: 'MEVHANI' },

  { my: 'MEVHANA', their: 'BAYKO', result: 'MEVHANI' },
  { my: 'MEVHANI', their: 'NAVRA', result: 'SADU' },
  { my: 'NANAND', their: 'NAVRA', result: 'NANANDOI' },

  // ─────────────────────────────────────────────────────────────────────────────
  // 23. GREAT-GRANDPARENTS (PANJOBA / PANAAJI)
  // ─────────────────────────────────────────────────────────────────────────────
  { my: 'PANJOBA', their: 'BAYKO', result: 'PANAAJI' },
  { my: 'PANJOBA', their: 'MULGA', result: 'AJOBA' },
  { my: 'PANAAJI', their: 'NAVRA', result: 'PANJOBA' },
  { my: 'PANAAJI', their: 'MULGA', result: 'AJOBA' },
];

/** Build a lookup map keyed by "myCode:theirCode" → resultCode */
export const COMPOSITION_MAP: Map<string, string> = new Map(
  COMPREHENSIVE_COMPOSITION_TABLE.map(({ my, their, result }) => [`${my}:${their}`, result])
);

/** Compose A→B and B→C into a suggested A→C relation code, or null if unknown. */
export function composeRelations(myCodeToIntermediary: string, intermediaryCodeToCandidate: string): string | null {
  const key = `${myCodeToIntermediary}:${intermediaryCodeToCandidate}`;
  return COMPOSITION_MAP.get(key) ?? null;
}

