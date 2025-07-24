#!/system/sh
# logger
log() {
    local time=$(date +%H:%M:%S)
    echo "$time $1" >> /data/adb/switchprofile/switchprofile.log
}
log_info() { log "[INFO] $1"; }
log_error() { log "[ERROR] $1"; }
log_warn() { log "[WARN] $1"; }
log_debug() { log "[DEBUG] $1"; }
# tools
Installer_Module() {
    if [ "$Installer_Compatibility" = "true" ]; then
            if [ "$KSU" = true ]; then
                ksud module install "$1"
            elif [ "$APATCH" = true ]; then
                apd module install "$1"
            elif [ -z "$KSU" ] && [ -z "$APATCH" ] && [ -n "$MAGISK_VER_CODE" ]; then
                magisk --install-module "$1"
            else
                log_error "Failed to install module $1"
            fi
    elif [ "$Installer_Compatibility" = "false" ]; then
        Installer_Compatibility_mode "$1"
    fi
}
Installer_Compatibility_mode() {
    MODIDBACKUP="$MODID"
    MODPATHBACKUP=$MODPATH
    for ZIPFILE in $1; do
        if [ "$Installer_Log" = "false" ]; then
            install_module >/dev/null 2>&1
        elif [ "$Installer_Log" = "true" ]; then
            install_module
        fi
    done
    MODPATH=$MODPATHBACKUP
    MODID="$MODIDBACKUP"
}
Delete_Module() {
rm -rf "/data/adb/modules/$1"
}
flash_boot() {
    local img_path="$1"
    if [[ "$img_path" == *".zip" ]]; then
        if [[ ! -f "$img_path" ]]; then
            log_error "Not found AnyKernel3 zip $img_path"
            return 1
        fi
        rm -rf /data/adb/switchprofile/anykernel/
        sleep 3
        unzip "$img_path" -d /data/adb/switchprofile/anykernel/
        chmod -R 755 /data/adb/switchprofile/anykernel/
        if [[ ! -f /data/adb/switchprofile/anykernel/anykernel.sh ]]; then
            log_error "Not found anykernel.sh in AnyKernel3 zip"
            return 1
        fi
        cd /data/adb/switchprofile/anykernel/
        /data/adb/switchprofile/anykernel/tools/busybox sh anykernel.sh
        if [[ $? -ne 0 ]]; then
            log_error "Failed to execute anykernel.sh"
            return 1
        fi
        rm -rf /data/adb/switchprofile/anykernel/
    fi
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
    if [[ ! -f "$img_path" ]]; then
        log_error "Not found image $img_path"
        return 1
    fi
    if [[ "$bootinfo" == "init_boot" ]]; then
        mv -f "$img_path" init_boot.img
        dd if=init_boot.img of="$position" bs=4M
    else
        dd if="$img_path" of="$position" bs=4M
    fi
    if [[ $? -ne 0 ]]; then
        log_error "Failed to write image to $position"
        return 1
    fi
    log_info "Write $bootinfo to $position"
}