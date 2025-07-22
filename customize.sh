flash_boot() {
    local img_path="$1"
    if [[ ! -d "/dev/block/by-name" ]]; then
        SITE="/dev/block/bootdevice/by-name"
        if [[ ! -d "$SITE" ]]; then
            log_error "Not found partition $SITE"
            return 1
        fi
    else
        SITE="/dev/block/by-name"
    fi
    ls "$SITE" | grep init_boot >/dev/null 2>&1
    if [[ $? -ne 0 ]]; then
        bootinfo="boot"
    else
        bootinfo="init_boot"
    fi
    BOOTAB="$(getprop ro.build.ab_update)"
    Partition_location="$(getprop ro.boot.slot_suffix)"
    if [[ "$BOOTAB" = "true" ]]; then
        if [[ "$Partition_location" == "_a" ]]; then
            log_info "You are in A partition"
            position=$(ls -l "$SITE/${bootinfo}_a" | awk '{print $NF}')
        elif [[ "$Partition_location" == "_b" ]]; then
            log_info "You are in B partition"
            position=$(ls -l "$SITE/${bootinfo}_b" | awk '{print $NF}')
        else
            log_info "Not found partition, default to A"
            position=$(ls -l "$SITE/${bootinfo}_a" | awk '{print $NF}')
        fi
    else
        position=$(ls -l "$SITE/${bootinfo}" | awk '{print $NF}')
    fi
    dd if=$position of=/data/adb/switchprofile/boot.img bs=4M
}